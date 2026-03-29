"""Repository for AcademicClass data access."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from school_service.models.academic_class import AcademicClass
from shared.schemas.class_schema import ClassCreate, ClassUpdate


class ClassRepository:
    """Repository for AcademicClass database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, class_data: ClassCreate) -> AcademicClass:
        """Create a new class."""
        academic_class = AcademicClass(
            school_id=class_data.school_id,
            name=class_data.name,
            description=class_data.description,
        )
        self.db.add(academic_class)
        await self.db.commit()
        await self.db.refresh(academic_class)
        return academic_class

    async def add_without_commit(self, school_id: int, name: str) -> AcademicClass:
        """Add a new class and flush (no commit). Used during bulk import."""
        academic_class = AcademicClass(school_id=school_id, name=name.strip())
        self.db.add(academic_class)
        await self.db.flush()
        await self.db.refresh(academic_class)
        return academic_class

    async def get_by_id(
        self, class_id: int, school_id: Optional[int] = None
    ) -> Optional[AcademicClass]:
        """
        Get class by ID.
        
        Args:
            class_id: Class ID
            school_id: Optional school ID to filter by (for authorization)
        
        Returns:
            AcademicClass instance or None if not found
        """
        query = select(AcademicClass).where(
            AcademicClass.id == class_id,
            AcademicClass.is_deleted == False
        )
        
        if school_id is not None:
            query = query.where(AcademicClass.school_id == school_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_name(
        self, name: str, school_id: int
    ) -> Optional[AcademicClass]:
        """
        Get class by name within a school.
        
        Args:
            name: Class name
            school_id: School ID
        
        Returns:
            AcademicClass instance or None if not found
        """
        result = await self.db.execute(
            select(AcademicClass).where(
                AcademicClass.name == name,
                AcademicClass.school_id == school_id,
                AcademicClass.is_deleted == False
            )
        )
        return result.scalar_one_or_none()

    async def list_classes(
        self, school_id: int
    ) -> List[AcademicClass]:
        """
        List all classes for a school.
        
        Args:
            school_id: School ID
        
        Returns:
            List of AcademicClass instances
        """
        result = await self.db.execute(
            select(AcademicClass)
            .where(
                AcademicClass.school_id == school_id,
                AcademicClass.is_deleted == False
            )
            .order_by(AcademicClass.name.asc())
        )
        return list(result.scalars().all())

    async def update(
        self, class_id: int, class_data: ClassUpdate, school_id: Optional[int] = None
    ) -> Optional[AcademicClass]:
        """
        Update class information.
        
        Args:
            class_id: Class ID
            class_data: Update data
            school_id: Optional school ID to verify ownership
        
        Returns:
            Updated AcademicClass instance or None if not found
        """
        # Get existing class
        query = select(AcademicClass).where(
            AcademicClass.id == class_id,
            AcademicClass.is_deleted == False
        )
        
        if school_id is not None:
            query = query.where(AcademicClass.school_id == school_id)
        
        result = await self.db.execute(query)
        academic_class = result.scalar_one_or_none()
        
        if not academic_class:
            return None
        
        # Convert Pydantic model to dict, excluding unset fields
        update_dict = class_data.model_dump(exclude_unset=True)
        
        # Update fields
        for key, value in update_dict.items():
            setattr(academic_class, key, value)
        
        await self.db.commit()
        await self.db.refresh(academic_class)
        return academic_class

    async def delete(self, class_id: int, school_id: Optional[int] = None) -> bool:
        """
        Soft delete a class.
        
        Args:
            class_id: Class ID
            school_id: Optional school ID to verify ownership
        
        Returns:
            True if deleted, False if not found
        """
        query = select(AcademicClass).where(
            AcademicClass.id == class_id,
            AcademicClass.is_deleted == False
        )
        
        if school_id is not None:
            query = query.where(AcademicClass.school_id == school_id)
        
        result = await self.db.execute(query)
        academic_class = result.scalar_one_or_none()
        
        if not academic_class:
            return False
        
        academic_class.is_deleted = True
        await self.db.commit()
        return True

