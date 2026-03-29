"""Service layer for teacher CRUD and bulk import."""

import csv
import io
import math
from typing import Optional, List, Callable, Awaitable

from sqlalchemy.ext.asyncio import AsyncSession

from school_service.repositories.teacher_repository import TeacherRepository
from school_service.schemas.teacher import (
    TeacherCreate,
    TeacherUpdate,
    TeacherResponse,
    TeacherBulkRow,
    TeacherBulkImportResult,
    PaginatedTeacherResponse,
)


class TeacherService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = TeacherRepository(db)

    # ------------------------------------------------------------------
    # List
    # ------------------------------------------------------------------

    async def list_teachers(
        self,
        school_id: int,
        *,
        search: Optional[str] = None,
        department: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> PaginatedTeacherResponse:
        items, total = await self.repo.list_teachers(
            school_id,
            search=search,
            department=department,
            is_active=is_active,
            page=page,
            page_size=page_size,
        )
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        return PaginatedTeacherResponse(
            items=[TeacherResponse.model_validate(t) for t in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    # ------------------------------------------------------------------
    # Single CRUD
    # ------------------------------------------------------------------

    async def create_teacher(
        self, school_id: int, data: TeacherCreate
    ) -> TeacherResponse:
        # Check phone uniqueness
        existing = await self.repo.get_by_phone(data.phone, school_id)
        if existing:
            raise ValueError(f"A teacher with phone '{data.phone}' already exists in this school.")
        teacher = await self.repo.create(school_id, data.model_dump())
        return TeacherResponse.model_validate(teacher)

    async def get_teacher(self, teacher_id: int, school_id: int) -> TeacherResponse:
        teacher = await self.repo.get_by_id(teacher_id, school_id)
        if not teacher:
            raise LookupError("Teacher not found.")
        return TeacherResponse.model_validate(teacher)

    async def update_teacher(
        self, teacher_id: int, school_id: int, data: TeacherUpdate
    ) -> TeacherResponse:
        teacher = await self.repo.get_by_id(teacher_id, school_id)
        if not teacher:
            raise LookupError("Teacher not found.")
        update_data = data.model_dump(exclude_unset=True)
        # If phone is being changed, check uniqueness
        if "phone" in update_data and update_data["phone"] != teacher.phone:
            existing = await self.repo.get_by_phone(update_data["phone"], school_id)
            if existing:
                raise ValueError(f"Phone '{update_data['phone']}' is already in use by another teacher.")
        updated = await self.repo.update(teacher, update_data)
        return TeacherResponse.model_validate(updated)

    async def delete_teacher(self, teacher_id: int, school_id: int) -> None:
        teacher = await self.repo.get_by_id(teacher_id, school_id)
        if not teacher:
            raise LookupError("Teacher not found.")
        await self.repo.soft_delete(teacher)

    # ------------------------------------------------------------------
    # Bulk import (CSV/TSV text rows)
    # ------------------------------------------------------------------

    PROGRESS_INTERVAL = 10

    async def bulk_import(
        self,
        school_id: int,
        rows: List[TeacherBulkRow],
        *,
        progress_callback: Optional[Callable[[int, int], Awaitable[None]]] = None,
    ) -> TeacherBulkImportResult:
        inserted = 0
        updated = 0
        skipped = 0
        errors: List[str] = []
        total = len(rows)

        for i, row in enumerate(rows):
            label = f"Row {i + 1} ({row.first_name} {row.last_name})"
            if not row.phone:
                errors.append(f"{label}: phone is required.")
                skipped += 1
                continue
            existing = await self.repo.get_by_phone(row.phone, school_id)
            if existing:
                try:
                    await self.repo.update(existing, row.model_dump())
                    updated += 1
                except Exception as exc:
                    errors.append(f"{label}: {exc}")
                    skipped += 1
                continue
            try:
                await self.repo.create(school_id, row.model_dump())
                inserted += 1
            except Exception as exc:
                errors.append(f"{label}: {exc}")
                skipped += 1

            processed = inserted + updated + skipped
            if progress_callback and processed % self.PROGRESS_INTERVAL == 0 and total:
                await progress_callback(processed, total)

        if progress_callback and total:
            await progress_callback(total, total)

        return TeacherBulkImportResult(
            inserted=inserted,
            updated=updated,
            skipped=skipped,
            errors=errors,
            total=inserted + updated + skipped,
        )
