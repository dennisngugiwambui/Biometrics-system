"""Repository for Stream data access."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from school_service.models.stream import Stream
from shared.schemas.stream_schema import StreamCreate, StreamUpdate


class StreamRepository:
    """Repository for Stream database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, stream_data: StreamCreate) -> Stream:
        """Create a new stream."""
        stream = Stream(
            class_id=stream_data.class_id,
            name=stream_data.name,
            description=stream_data.description,
        )
        self.db.add(stream)
        await self.db.commit()
        await self.db.refresh(stream)
        return stream

    async def add_without_commit(self, class_id: int, name: str) -> Stream:
        """Add a new stream and flush (no commit). Used during bulk import."""
        stream = Stream(class_id=class_id, name=name.strip())
        self.db.add(stream)
        await self.db.flush()
        await self.db.refresh(stream)
        return stream

    async def get_by_id(
        self, stream_id: int, school_id: Optional[int] = None
    ) -> Optional[Stream]:
        """
        Get stream by ID.
        
        Args:
            stream_id: Stream ID
            school_id: Optional school ID to filter by (for authorization via class)
        
        Returns:
            Stream instance or None if not found
        """
        query = select(Stream).where(
            Stream.id == stream_id,
            Stream.is_deleted == False
        )
        
        if school_id is not None:
            # Join with class to filter by school_id
            from school_service.models.academic_class import AcademicClass
            query = query.join(AcademicClass).where(
                AcademicClass.school_id == school_id,
                AcademicClass.is_deleted == False
            )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_name(
        self, name: str, class_id: int
    ) -> Optional[Stream]:
        """
        Get stream by name within a class.
        
        Args:
            name: Stream name
            class_id: Class ID
        
        Returns:
            Stream instance or None if not found
        """
        result = await self.db.execute(
            select(Stream).where(
                Stream.name == name,
                Stream.class_id == class_id,
                Stream.is_deleted == False
            )
        )
        return result.scalar_one_or_none()

    async def list_streams(
        self, school_id: int, class_id: Optional[int] = None
    ) -> List[Stream]:
        """
        List streams for a school, optionally filtered by class.
        
        Args:
            school_id: School ID
            class_id: Optional class ID to filter by
        
        Returns:
            List of Stream instances
        """
        from school_service.models.academic_class import AcademicClass
        
        query = (
            select(Stream)
            .join(AcademicClass)
            .where(
                AcademicClass.school_id == school_id,
                AcademicClass.is_deleted == False,
                Stream.is_deleted == False
            )
        )
        
        if class_id is not None:
            query = query.where(Stream.class_id == class_id)
        
        query = query.order_by(Stream.name.asc())
        
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(
        self, stream_id: int, stream_data: StreamUpdate, school_id: Optional[int] = None
    ) -> Optional[Stream]:
        """
        Update stream information.
        
        Args:
            stream_id: Stream ID
            stream_data: Update data
            school_id: Optional school ID to verify ownership via class
        
        Returns:
            Updated Stream instance or None if not found
        """
        # Get existing stream
        query = select(Stream).where(
            Stream.id == stream_id,
            Stream.is_deleted == False
        )
        
        if school_id is not None:
            from school_service.models.academic_class import AcademicClass
            query = query.join(AcademicClass).where(
                AcademicClass.school_id == school_id,
                AcademicClass.is_deleted == False
            )
        
        result = await self.db.execute(query)
        stream = result.scalar_one_or_none()
        
        if not stream:
            return None
        
        # Convert Pydantic model to dict, excluding unset fields
        update_dict = stream_data.model_dump(exclude_unset=True)
        
        # Update fields
        for key, value in update_dict.items():
            setattr(stream, key, value)
        
        await self.db.commit()
        await self.db.refresh(stream)
        return stream

    async def delete(self, stream_id: int, school_id: Optional[int] = None) -> bool:
        """
        Soft delete a stream.
        
        Args:
            stream_id: Stream ID
            school_id: Optional school ID to verify ownership via class
        
        Returns:
            True if deleted, False if not found
        """
        query = select(Stream).where(
            Stream.id == stream_id,
            Stream.is_deleted == False
        )
        
        if school_id is not None:
            from school_service.models.academic_class import AcademicClass
            query = query.join(AcademicClass).where(
                AcademicClass.school_id == school_id,
                AcademicClass.is_deleted == False
            )
        
        result = await self.db.execute(query)
        stream = result.scalar_one_or_none()
        
        if not stream:
            return False
        
        stream.is_deleted = True
        await self.db.commit()
        return True

