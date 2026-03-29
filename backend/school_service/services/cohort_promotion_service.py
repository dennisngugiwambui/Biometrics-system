"""End-of-year style cohort promotion: graduate top class, shift others up by stream name."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from school_service.models.stream import Stream
from school_service.repositories.class_repository import ClassRepository
from school_service.repositories.stream_repository import StreamRepository
from school_service.repositories.student_repository import StudentRepository
from school_service.services.alumni_service import record_graduations

logger = logging.getLogger(__name__)


class CohortPromotionService:
    """Promote students along an ordered class ladder (e.g. Form 1 to Form 4) and graduate the top."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.class_repo = ClassRepository(db)
        self.stream_repo = StreamRepository(db)
        self.student_repo = StudentRepository(db)

    async def _resolve_target_stream_id(
        self,
        school_id: int,
        target_class_id: int,
        source_stream_name: Optional[str],
        *,
        create_if_missing: bool,
    ) -> Optional[int]:
        streams = await self.stream_repo.list_streams(school_id, target_class_id)
        if not streams and create_if_missing:
            name = (source_stream_name or "A").strip()[:50] or "A"
            stream = Stream(class_id=target_class_id, name=name)
            self.db.add(stream)
            await self.db.flush()
            await self.db.refresh(stream)
            return stream.id

        by_name = {s.name: s for s in streams}
        if source_stream_name:
            if source_stream_name in by_name:
                return by_name[source_stream_name].id
            low = source_stream_name.strip().lower()
            for nm, st in by_name.items():
                if nm.lower() == low:
                    return st.id
            if create_if_missing:
                stream = Stream(class_id=target_class_id, name=source_stream_name.strip()[:50])
                self.db.add(stream)
                await self.db.flush()
                await self.db.refresh(stream)
                return stream.id

        return streams[0].id if streams else None

    async def run_promotion(
        self,
        school_id: int,
        ladder_class_ids: List[int],
        *,
        graduate_top_rung: bool = True,
        create_target_streams_if_missing: bool = True,
    ) -> dict[str, Any]:
        """
        ladder_class_ids: ordered lowest to highest (e.g. Form 1 id then Form 4 id).

        1) Optionally graduates all active students in the highest class.
        2) Moves active students from each rung into the next, matching stream by name.
        """
        if len(ladder_class_ids) < 2:
            raise ValueError("Provide at least two classes: lowest grade first, highest last.")

        ladder: list[int] = []
        seen: set[int] = set()
        for cid in ladder_class_ids:
            if cid not in seen:
                ladder.append(cid)
                seen.add(cid)

        for cid in ladder:
            c = await self.class_repo.get_by_id(cid, school_id)
            if not c:
                raise ValueError(f"Class {cid} was not found for this school.")

        graduated_ids: list[int] = []
        alumni_created = 0

        if graduate_top_rung:
            top_id = ladder[-1]
            top_students = await self.student_repo.list_active_for_class(school_id, top_id)
            graduated_ids = [s.id for s in top_students]
            if graduated_ids:
                year = date.today().year
                alumni_created = await record_graduations(
                    self.db, school_id, top_students, year
                )
                n = await self.student_repo.mark_graduated_batch(
                    graduated_ids, school_id, date.today()
                )
                logger.info("Graduated %s students from class_id=%s", n, top_id)

        moved = 0
        moves_by_step: list[dict[str, Any]] = []

        for i in range(len(ladder) - 2, -1, -1):
            source_id = ladder[i]
            target_id = ladder[i + 1]
            students = await self.student_repo.list_active_for_class(school_id, source_id)
            step_moved = 0
            for st in students:
                stream_name = st.stream.name if st.stream else None
                target_stream_id = await self._resolve_target_stream_id(
                    school_id,
                    target_id,
                    stream_name,
                    create_if_missing=create_target_streams_if_missing,
                )
                if target_stream_id is None:
                    raise ValueError(
                        f"Could not place student id={st.id} into class_id={target_id}: "
                        "add at least one stream to that class or enable stream auto-create."
                    )
                st.class_id = target_id
                st.stream_id = target_stream_id
                step_moved += 1
                moved += 1
            moves_by_step.append(
                {
                    "from_class_id": source_id,
                    "to_class_id": target_id,
                    "students_moved": step_moved,
                }
            )

        await self.db.commit()

        return {
            "graduated_count": len(graduated_ids),
            "graduated_student_ids": graduated_ids,
            "moved_count": moved,
            "moves_by_step": moves_by_step,
            "alumni_records_created": alumni_created,
        }
