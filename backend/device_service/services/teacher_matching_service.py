"""Service for resolving device_user_id to teacher_id.

During sync, teachers are written to devices with:
  uid = teacher_id (int)
  user_id = f"T{teacher_id}" (string)

So device_user_id in attendance logs for teachers is expected to look like "T123".
This service validates that the teacher exists and belongs to the correct school.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.models.teacher import Teacher

logger = logging.getLogger(__name__)


class TeacherMatchingService:
    """Batch-resolves device_user_id values to teacher_id values."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def resolve_batch(self, school_id: int, device_user_ids: list[str]) -> dict[str, int]:
        # Parse candidate teacher IDs (must start with 'T')
        candidate_ids: dict[int, str] = {}
        for duid in set(device_user_ids):
            if not duid:
                continue
            if not isinstance(duid, str):
                duid = str(duid)
            if not duid.startswith("T"):
                continue
            raw = duid[1:]
            try:
                tid = int(raw)
                candidate_ids[tid] = duid
            except (ValueError, TypeError):
                logger.debug("Non-numeric teacher device_user_id '%s' — cannot match", duid)

        if not candidate_ids:
            return {}

        query = (
            select(Teacher.id)
            .where(
                Teacher.school_id == school_id,
                Teacher.id.in_(list(candidate_ids.keys())),
                Teacher.is_deleted == False,  # noqa: E712
            )
        )
        result = await self.db.execute(query)
        existing_ids = {row[0] for row in result.all()}

        mapping: dict[str, int] = {}
        for tid, duid in candidate_ids.items():
            if tid in existing_ids:
                mapping[duid] = tid
            else:
                logger.debug(
                    "device_user_id '%s' parsed as teacher %d but teacher not found in school %d",
                    duid,
                    tid,
                    school_id,
                )

        logger.debug(
            "Teacher matching: %d/%d device_user_ids resolved for school %d",
            len(mapping),
            len(set(device_user_ids)),
            school_id,
        )
        return mapping
