"""Write alumni registry rows when students graduate."""

from __future__ import annotations

import logging
from typing import Sequence

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.models.alumni_record import AlumniRecord
from school_service.models.student import Student

logger = logging.getLogger(__name__)


async def record_graduations(
    db: AsyncSession,
    school_id: int,
    students: Sequence[Student],
    graduation_year: int,
) -> int:
    """
    Insert one alumni row per student for this calendar year; skip duplicates.
    Students should have ``class_`` loaded for exit_class_name.
    """
    if not students:
        return 0
    created = 0
    for st in students:
        exit_name = st.class_.name if getattr(st, "class_", None) else None
        stmt = (
            pg_insert(AlumniRecord)
            .values(
                student_id=st.id,
                school_id=school_id,
                graduation_year=graduation_year,
                exit_class_name=exit_name,
            )
            .on_conflict_do_nothing(constraint="uq_alumni_student_grad_year")
        )
        result = await db.execute(stmt)
        if result.rowcount:
            created += int(result.rowcount)
    return created
