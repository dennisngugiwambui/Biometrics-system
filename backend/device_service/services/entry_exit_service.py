"""Service for determining whether an attendance tap is IN, OUT, or DUPLICATE.

Rules:
  1. No previous record for the student on the same calendar day → IN
  2. Last record was IN  and time gap >= anti-bounce → OUT
  3. Last record was OUT and time gap >= anti-bounce → IN
  4. Time gap < anti-bounce window → DUPLICATE (accidental double-scan)
  5. Student unknown (student_id is None) → UNKNOWN
"""

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import pytz
from sqlalchemy import select, and_, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from attendance_service.models.attendance_record import AttendanceRecord, EventType
from device_service.core.config import settings

logger = logging.getLogger(__name__)


class Determination(str, Enum):
    """Result of the entry/exit determination."""

    IN = "IN"
    OUT = "OUT"
    DUPLICATE = "DUPLICATE"
    UNKNOWN = "UNKNOWN"


class EntryExitService:
    """Determines IN/OUT/DUPLICATE for attendance taps."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.tz = pytz.timezone(settings.ATTENDANCE_TIMEZONE)
        self.anti_bounce = timedelta(seconds=settings.ATTENDANCE_ANTI_BOUNCE_SECONDS)

    # ------------------------------------------------------------------
    # Pure-logic determination (no DB query) — used by batch ingestion
    # ------------------------------------------------------------------

    def determine_from_previous(
        self,
        previous: Optional[tuple[str, datetime]],
        occurred_at: datetime,
    ) -> Determination:
        """
        Determine event type based on previous event info (no DB query).

        Args:
            previous: Tuple of (event_type, occurred_at) from the last record,
                      or None if no previous record today.
            occurred_at: The current tap timestamp.

        Returns:
            Determination enum: IN, OUT, or DUPLICATE.
        """
        if previous is None:
            return Determination.IN

        prev_event_type, prev_occurred_at = previous
        time_gap = occurred_at - prev_occurred_at

        if time_gap < self.anti_bounce:
            return Determination.DUPLICATE

        if prev_event_type == EventType.IN:
            return Determination.OUT
        elif prev_event_type == EventType.OUT:
            return Determination.IN
        else:
            # Previous was UNKNOWN — treat as first meaningful tap → IN
            return Determination.IN

    # ------------------------------------------------------------------
    # Batch query: get last record today for multiple students at once
    # ------------------------------------------------------------------

    async def get_last_records_for_students(
        self,
        school_id: int,
        student_ids: list[int],
        reference_time: datetime,
    ) -> dict[int, tuple[str, datetime]]:
        """
        Batch-query the last attendance record today for multiple students.

        Args:
            school_id: School ID.
            student_ids: List of student IDs to look up.
            reference_time: Reference timestamp for determining "today".

        Returns:
            Dict mapping student_id -> (event_type, occurred_at) for students
            that have at least one record today. Students with no records are
            omitted from the dict.
        """
        if not student_ids:
            return {}

        local_dt = reference_time.astimezone(self.tz)
        day_start_local = local_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        day_start_utc = day_start_local.astimezone(pytz.utc)

        # Subquery: max occurred_at per student today
        subq = (
            select(
                AttendanceRecord.student_id,
                sa_func.max(AttendanceRecord.occurred_at).label("max_ts"),
            )
            .where(
                and_(
                    AttendanceRecord.school_id == school_id,
                    AttendanceRecord.student_id.in_(student_ids),
                    AttendanceRecord.is_deleted == False,  # noqa: E712
                    AttendanceRecord.occurred_at >= day_start_utc,
                )
            )
            .group_by(AttendanceRecord.student_id)
            .subquery()
        )

        # Join back to get event_type of the max-timestamp row
        ar = aliased(AttendanceRecord)
        query = (
            select(ar.student_id, ar.event_type, ar.occurred_at)
            .join(
                subq,
                and_(
                    ar.student_id == subq.c.student_id,
                    ar.occurred_at == subq.c.max_ts,
                ),
            )
            .where(
                and_(
                    ar.school_id == school_id,
                    ar.is_deleted == False,  # noqa: E712
                )
            )
        )
        result = await self.db.execute(query)
        rows = result.all()

        return {row[0]: (row[1], row[2]) for row in rows}

    async def get_last_records_for_teachers(
        self,
        school_id: int,
        teacher_ids: list[int],
        reference_time: datetime,
    ) -> dict[int, tuple[str, datetime]]:
        if not teacher_ids:
            return {}

        local_dt = reference_time.astimezone(self.tz)
        day_start_local = local_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        day_start_utc = day_start_local.astimezone(pytz.utc)

        subq = (
            select(
                AttendanceRecord.teacher_id,
                sa_func.max(AttendanceRecord.occurred_at).label("max_ts"),
            )
            .where(
                and_(
                    AttendanceRecord.school_id == school_id,
                    AttendanceRecord.teacher_id.in_(teacher_ids),
                    AttendanceRecord.is_deleted == False,  # noqa: E712
                    AttendanceRecord.occurred_at >= day_start_utc,
                )
            )
            .group_by(AttendanceRecord.teacher_id)
            .subquery()
        )

        ar = aliased(AttendanceRecord)
        query = (
            select(ar.teacher_id, ar.event_type, ar.occurred_at)
            .join(
                subq,
                and_(
                    ar.teacher_id == subq.c.teacher_id,
                    ar.occurred_at == subq.c.max_ts,
                ),
            )
            .where(
                and_(
                    ar.school_id == school_id,
                    ar.is_deleted == False,  # noqa: E712
                )
            )
        )
        result = await self.db.execute(query)
        rows = result.all()

        return {row[0]: (row[1], row[2]) for row in rows}

    # ------------------------------------------------------------------
    # Single-record determination (with DB query) — kept for ad-hoc use
    # ------------------------------------------------------------------

    async def determine(
        self,
        school_id: int,
        student_id: Optional[int],
        occurred_at: datetime,
    ) -> Determination:
        """
        Determine the event type for an attendance tap (single record, queries DB).

        Args:
            school_id: The school ID.
            student_id: The matched student ID, or None if unmatched.
            occurred_at: The timestamp of the tap (timezone-aware).

        Returns:
            Determination enum: IN, OUT, DUPLICATE, or UNKNOWN.
        """
        if student_id is None:
            return Determination.UNKNOWN

        last_record = await self._get_last_record_today(school_id, student_id, occurred_at)

        if last_record is None:
            return Determination.IN

        return self.determine_from_previous(
            previous=(last_record.event_type, last_record.occurred_at),
            occurred_at=occurred_at,
        )

    async def _get_last_record_today(
        self,
        school_id: int,
        student_id: int,
        occurred_at: datetime,
    ) -> Optional[AttendanceRecord]:
        """
        Get the most recent non-deleted attendance record for this student
        on the same calendar day (in the configured timezone).
        """
        local_dt = occurred_at.astimezone(self.tz)
        day_start_local = local_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        day_start_utc = day_start_local.astimezone(pytz.utc)

        query = (
            select(AttendanceRecord)
            .where(
                and_(
                    AttendanceRecord.school_id == school_id,
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.is_deleted == False,  # noqa: E712
                    AttendanceRecord.occurred_at >= day_start_utc,
                    AttendanceRecord.occurred_at < occurred_at,
                )
            )
            .order_by(AttendanceRecord.occurred_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
