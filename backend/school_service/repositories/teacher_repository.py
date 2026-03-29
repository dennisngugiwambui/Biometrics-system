"""Repository for Teacher database operations."""

import math
from typing import Optional, List, Tuple

from sqlalchemy import select, func, or_, and_, Text
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.models.teacher import Teacher


class TeacherRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Read
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
    ) -> Tuple[List[Teacher], int]:
        query = select(Teacher).where(
            Teacher.school_id == school_id,
            Teacher.is_deleted == False,  # noqa: E712
        )
        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Teacher.first_name.ilike(pattern),
                    Teacher.last_name.ilike(pattern),
                    Teacher.employee_id.ilike(pattern),
                    Teacher.phone.ilike(pattern),
                    Teacher.subject.cast(Text).ilike(pattern),
                )
            )
        if department:
            query = query.where(Teacher.department.ilike(f"%{department}%"))
        if is_active is not None:
            query = query.where(Teacher.is_active == is_active)

        # Total
        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        # Paginated
        offset = (page - 1) * page_size
        query = query.order_by(Teacher.first_name, Teacher.last_name).offset(offset).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def get_by_id(self, teacher_id: int, school_id: int) -> Optional[Teacher]:
        result = await self.db.execute(
            select(Teacher).where(
                Teacher.id == teacher_id,
                Teacher.school_id == school_id,
                Teacher.is_deleted == False,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str, school_id: int) -> Optional[Teacher]:
        result = await self.db.execute(
            select(Teacher).where(
                Teacher.phone == phone,
                Teacher.school_id == school_id,
                Teacher.is_deleted == False,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    async def create(self, school_id: int, data: dict) -> Teacher:
        teacher = Teacher(school_id=school_id, **data)
        self.db.add(teacher)
        await self.db.flush()  # get ID before generating employee_id
        teacher.employee_id = f"TID-{school_id:04d}-{teacher.id:04d}"
        await self.db.commit()
        await self.db.refresh(teacher)
        return teacher

    async def update(self, teacher: Teacher, data: dict) -> Teacher:
        for key, value in data.items():
            if value is not None:
                setattr(teacher, key, value)
        await self.db.commit()
        await self.db.refresh(teacher)
        return teacher

    async def soft_delete(self, teacher: Teacher) -> None:
        teacher.is_deleted = True
        await self.db.commit()
