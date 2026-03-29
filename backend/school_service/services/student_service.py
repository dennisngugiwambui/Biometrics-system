"""Service layer for Student business logic."""

from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Tuple, Callable, Awaitable

from school_service.repositories.student_repository import StudentRepository
from school_service.repositories.class_repository import ClassRepository
from school_service.repositories.stream_repository import StreamRepository
from school_service.models.student import Student
from school_service.models.academic_class import AcademicClass
from school_service.models.stream import Stream
from school_service.services.class_stream_normalize import (
    normalize_class_name,
    normalize_stream_name,
    class_names_match,
    stream_names_match,
)
from shared.schemas.student import StudentCreate, StudentUpdate, StudentBulkRow, StudentBulkImportResult


class StudentService:
    """Service for Student business logic."""

    def __init__(self, db: AsyncSession):
        self.repository = StudentRepository(db)
        self.class_repo = ClassRepository(db)
        self.stream_repo = StreamRepository(db)
        self.db = db

    async def create_student(self, student_data: StudentCreate) -> Student:
        """
        Create a new student.
        
        Args:
            student_data: Student creation data
            
        Returns:
            Created Student instance
            
        Raises:
            ValueError: If admission number already exists for the school
        """
        # Check for duplicate admission number within the school
        existing = await self.repository.get_by_admission_number(
            admission_number=student_data.admission_number,
            school_id=student_data.school_id
        )
        if existing:
            raise ValueError(
                f"Admission number '{student_data.admission_number}' already exists for this school"
            )
        
        # Create student
        student = await self.repository.create(student_data)
        return student

    # ... [existing methods]

    # Batch size for bulk import - flush to DB every N rows to reduce round-trips
    BULK_IMPORT_BATCH_SIZE = 100
    # Progress callback interval (rows)
    PROGRESS_INTERVAL = 10

    async def bulk_import(
        self,
        school_id: int,
        student_rows: List[StudentBulkRow],
        *,
        progress_callback: Optional[Callable[[int, int], Awaitable[None]]] = None,
    ) -> StudentBulkImportResult:
        """
        Bulk import students. Normalizes class/stream names (fixes typos, collapses ranges),
        fuzzy-matches to existing classes/streams, and auto-creates them if not registered.
        """
        result = StudentBulkImportResult(total=len(student_rows), inserted=0, skipped=0, errors=[])

        # Load existing classes and streams for fuzzy match and auto-create
        classes_list: List[AcademicClass] = await self.class_repo.list_classes(school_id)
        streams_list: List[Stream] = await self.stream_repo.list_streams(school_id, class_id=None)
        streams_by_class: dict[int, List[Stream]] = {}
        for s in streams_list:
            streams_by_class.setdefault(s.class_id, []).append(s)

        # Cache: normalized key -> id (so we reuse same class/stream within this import)
        class_cache: dict[str, int] = {}  # normalized_class_name_lower -> class_id
        stream_cache: dict[Tuple[int, str], int] = {}  # (class_id, stream_name_lower) -> stream_id

        try:
            for i, row in enumerate(student_rows, start=1):
                try:
                    # Resolve class_id and stream_id (same for create and update)
                    class_id: Optional[int] = None
                    canonical_class = normalize_class_name(row.class_name) if row.class_name else ""
                    if canonical_class:
                        key_lower = canonical_class.lower()
                        if key_lower in class_cache:
                            class_id = class_cache[key_lower]
                        else:
                            matched: Optional[AcademicClass] = None
                            for cls in classes_list:
                                if class_names_match(cls.name, canonical_class):
                                    matched = cls
                                    break
                            if matched:
                                class_id = matched.id
                                class_cache[key_lower] = class_id
                            else:
                                new_cls = await self.class_repo.add_without_commit(school_id, canonical_class)
                                class_id = new_cls.id
                                class_cache[key_lower] = class_id
                                classes_list.append(new_cls)
                                streams_by_class[class_id] = []

                    stream_id: Optional[int] = None
                    if class_id and row.stream_name:
                        canonical_stream = normalize_stream_name(row.stream_name)
                        if canonical_stream:
                            stream_key = (class_id, canonical_stream.lower())
                            if stream_key in stream_cache:
                                stream_id = stream_cache[stream_key]
                            else:
                                stream_list = streams_by_class.get(class_id, [])
                                matched_stream: Optional[Stream] = None
                                for s in stream_list:
                                    if stream_names_match(s.name, canonical_stream):
                                        matched_stream = s
                                        break
                                if matched_stream:
                                    stream_id = matched_stream.id
                                    stream_cache[stream_key] = stream_id
                                else:
                                    new_stream = await self.stream_repo.add_without_commit(class_id, canonical_stream)
                                    stream_id = new_stream.id
                                    stream_cache[stream_key] = stream_id
                                    streams_by_class.setdefault(class_id, []).append(new_stream)

                    existing = await self.repository.get_by_admission_number(row.admission_number, school_id)
                    if existing:
                        # Same student (admission_number): update record instead of creating duplicate
                        existing.first_name = row.first_name
                        existing.last_name = row.last_name
                        existing.date_of_birth = row.date_of_birth
                        existing.gender = row.gender
                        existing.parent_phone = row.parent_phone
                        existing.parent_email = row.parent_email
                        existing.is_boarding = row.is_boarding
                        existing.class_id = class_id
                        existing.stream_id = stream_id
                        result.updated += 1
                    else:
                        create_data = StudentCreate(
                            school_id=school_id,
                            admission_number=row.admission_number,
                            first_name=row.first_name,
                            last_name=row.last_name,
                            date_of_birth=row.date_of_birth,
                            gender=row.gender,
                            parent_phone=row.parent_phone,
                            parent_email=row.parent_email,
                            is_boarding=row.is_boarding,
                            class_id=class_id,
                            stream_id=stream_id,
                        )
                        await self.repository.create(create_data, commit=False, flush=False)
                        result.inserted += 1

                    if (result.inserted + result.updated) % self.BULK_IMPORT_BATCH_SIZE == 0:
                        await self.db.flush()
                    processed = result.inserted + result.updated + result.skipped
                    if progress_callback and processed % self.PROGRESS_INTERVAL == 0:
                        await progress_callback(processed, len(student_rows))
                except Exception as e:
                    result.skipped += 1
                    result.errors.append(f"Row {i}: Unexpected error: {str(e)}")
                    processed = result.inserted + result.updated + result.skipped
                    if progress_callback and processed % self.PROGRESS_INTERVAL == 0:
                        await progress_callback(processed, len(student_rows))

            if progress_callback:
                await progress_callback(len(student_rows), len(student_rows))
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def get_student_by_id(
        self, student_id: int, school_id: Optional[int] = None
    ) -> Optional[Student]:
        """
        Get student by ID.
        
        Args:
            student_id: Student ID
            school_id: Optional school ID for authorization
        
        Returns:
            Student instance or None if not found
        """
        return await self.repository.get_by_id(student_id, school_id)

    async def list_students(
        self,
        school_id: int,
        page: int = 1,
        page_size: int = 50,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        search: Optional[str] = None,
        include_graduated: bool = False,
    ) -> Tuple[List[Student], int]:
        """
        List students with pagination and filtering.
        
        Args:
            school_id: School ID (required)
            page: Page number (1-indexed)
            page_size: Items per page
            class_id: Optional filter by class ID
            stream_id: Optional filter by stream ID
            search: Optional search term
        
        Returns:
            Tuple of (list of students, total count)
        """
        return await self.repository.list_students(
            school_id=school_id,
            page=page,
            page_size=page_size,
            class_id=class_id,
            stream_id=stream_id,
            search=search,
            include_graduated=include_graduated,
        )

    async def update_student(
        self, student_id: int, student_data: StudentUpdate, school_id: Optional[int] = None
    ) -> Optional[Student]:
        """
        Update student information.
        
        Args:
            student_id: Student ID
            student_data: Update data
            school_id: Optional school ID for authorization
        
        Returns:
            Updated Student instance or None if not found
        """
        return await self.repository.update(student_id, student_data, school_id)

    async def delete_student(
        self, student_id: int, school_id: Optional[int] = None
    ) -> bool:
        """
        Soft delete a student.
        
        Args:
            student_id: Student ID
            school_id: Optional school ID for authorization
        
        Returns:
            True if deleted, False if not found
        """
        return await self.repository.delete(student_id, school_id)

