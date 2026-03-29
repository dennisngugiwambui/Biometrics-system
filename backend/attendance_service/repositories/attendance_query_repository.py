"""Repository for querying attendance records (read-side, used by Attendance Service API)."""

import math
from datetime import date, datetime, timedelta
from typing import Optional, Literal

import pytz
from sqlalchemy import select, func, and_, case, distinct, or_, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from attendance_service.models.attendance_record import AttendanceRecord, EventType
from school_service.models.student import Student
from school_service.models.teacher import Teacher
from device_service.models.device import Device

PresenceBasis = Literal["daily", "session"]


class AttendanceQueryRepository:
    """Read-optimised queries for the attendance API."""

    def __init__(self, db: AsyncSession, tz_name: str = "Africa/Nairobi"):
        self.db = db
        self.tz = pytz.timezone(tz_name)

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _day_boundaries(self, target_date: date) -> tuple[datetime, datetime]:
        """Return (start_utc, end_utc) for *target_date* in the configured tz."""
        start_local = self.tz.localize(datetime.combine(target_date, datetime.min.time()))
        end_local = start_local + timedelta(days=1)
        return start_local.astimezone(pytz.utc), end_local.astimezone(pytz.utc)

    # ------------------------------------------------------------------
    # list (paginated + filtered)
    # ------------------------------------------------------------------

    async def list_records(
        self,
        school_id: int,
        *,
        target_date: Optional[date] = None,
        user_type: Optional[Literal["student", "teacher"]] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        student_id: Optional[int] = None,
        teacher_id: Optional[int] = None,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        device_id: Optional[int] = None,
        event_type: Optional[str] = None,
        is_boarding: Optional[bool] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        """
        Return a page of enriched attendance records plus total count.
        """
        # base conditions
        conditions = [
            AttendanceRecord.school_id == school_id,
            AttendanceRecord.is_deleted == False,  # noqa: E712
        ]

        if user_type == "student":
            conditions.append(AttendanceRecord.student_id.isnot(None))
        elif user_type == "teacher":
            conditions.append(AttendanceRecord.teacher_id.isnot(None))

        # Date filtering: either a single day (target_date) or an explicit range.
        if target_date is not None:
            start_utc, end_utc = self._day_boundaries(target_date)
            conditions.append(AttendanceRecord.occurred_at >= start_utc)
            conditions.append(AttendanceRecord.occurred_at < end_utc)
        else:
            if date_from is not None:
                start_utc, _ = self._day_boundaries(date_from)
                conditions.append(AttendanceRecord.occurred_at >= start_utc)
            if date_to is not None:
                _, end_utc = self._day_boundaries(date_to)
                conditions.append(AttendanceRecord.occurred_at < end_utc)

        if student_id is not None:
            conditions.append(AttendanceRecord.student_id == student_id)
            
        if teacher_id is not None:
            conditions.append(AttendanceRecord.teacher_id == teacher_id)

        if device_id is not None:
            conditions.append(AttendanceRecord.device_id == device_id)

        if event_type is not None:
            conditions.append(AttendanceRecord.event_type == event_type)

        if class_id is not None:
            conditions.append(Student.class_id == class_id)

        if stream_id is not None:
            conditions.append(Student.stream_id == stream_id)

        if is_boarding is not None:
            conditions.append(Student.is_boarding == is_boarding)

        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(
                    Student.first_name.ilike(pattern),
                    Student.last_name.ilike(pattern),
                    Student.admission_number.ilike(pattern),
                    Teacher.first_name.ilike(pattern),
                    Teacher.last_name.ilike(pattern),
                    Teacher.employee_id.ilike(pattern),
                )
            )

        where = and_(*conditions)

        # --- count ---
        count_q = select(func.count(AttendanceRecord.id))

        needs_student_join = class_id is not None or stream_id is not None or is_boarding is not None
        needs_search_join = bool(search)
        if needs_student_join or needs_search_join:
            count_q = count_q.join(Student, AttendanceRecord.student_id == Student.id, isouter=True)
        if needs_search_join:
            count_q = count_q.join(Teacher, AttendanceRecord.teacher_id == Teacher.id, isouter=True)
        count_q = count_q.where(where)
        total = (await self.db.execute(count_q)).scalar_one()

        # --- data query ---
        q = (
            select(AttendanceRecord)
            .options(
                selectinload(AttendanceRecord.student).selectinload(Student.class_),
                selectinload(AttendanceRecord.student).selectinload(Student.stream),
                selectinload(AttendanceRecord.device),
                selectinload(AttendanceRecord.teacher),
            )
        )
        if needs_student_join or needs_search_join:
            q = q.join(Student, AttendanceRecord.student_id == Student.id, isouter=True)
        if needs_search_join:
            q = q.join(Teacher, AttendanceRecord.teacher_id == Teacher.id, isouter=True)
        q = (
            q.where(where)
            .order_by(AttendanceRecord.occurred_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(q)
        records = result.scalars().all()

        items = [self._to_event_dict(r) for r in records]
        return items, total

    # ------------------------------------------------------------------
    # stats
    # ------------------------------------------------------------------

    async def get_stats(
        self,
        school_id: int,
        target_date: date,
        total_users: int,
        user_type: Literal["student", "teacher"] = "student",
    ) -> dict:
        """
        Compute attendance stats for a single day.
        """
        start_utc, end_utc = self._day_boundaries(target_date)

        base = and_(
            AttendanceRecord.school_id == school_id,
            AttendanceRecord.is_deleted == False,  # noqa: E712
            AttendanceRecord.occurred_at >= start_utc,
            AttendanceRecord.occurred_at < end_utc,
        )
        
        id_field = AttendanceRecord.student_id if user_type == "student" else AttendanceRecord.teacher_id
        base = and_(base, id_field.isnot(None))

        # total events
        total_events_stmt = select(func.count(AttendanceRecord.id)).where(base)
        total_events = (await self.db.execute(total_events_stmt)).scalar_one()

        # unique users with at least one event today
        unique_present_stmt = select(func.count(distinct(id_field))).where(base)
        unique_present = (await self.db.execute(unique_present_stmt)).scalar_one()

        # Subquery: max occurred_at per user today
        subq = (
            select(
                id_field.label("user_id"),
                func.max(AttendanceRecord.occurred_at).label("max_ts"),
            )
            .where(base)
            .group_by(id_field)
            .subquery()
        )

        last_events = (
            await self.db.execute(
                select(AttendanceRecord.event_type, func.count())
                .join(
                    subq,
                    and_(
                        id_field == subq.c.user_id,
                        AttendanceRecord.occurred_at == subq.c.max_ts,
                    ),
                )
                .where(base)
                .group_by(AttendanceRecord.event_type)
            )
        ).all()

        checked_in = 0
        checked_out = 0
        for evt, cnt in last_events:
            if evt == EventType.IN:
                checked_in = cnt
            elif evt == EventType.OUT:
                checked_out = cnt

        present_rate = round((unique_present / total_users) * 100, 1) if total_users > 0 else 0.0

        return {
            "date": target_date,
            "total_events": total_events,
            "checked_in": checked_in,
            "checked_out": checked_out,
            "total_users": total_users,
            "present_rate": present_rate,
        }

    async def get_stats_range(
        self,
        school_id: int,
        date_from: date,
        date_to: date,
        total_users: int,
        user_type: Literal["student", "teacher"] = "student",
    ) -> list[dict]:
        """
        Compute attendance stats for each day in a date range.
        Currently uses a loop for correctness and simplicity, 
        suitable for common report ranges (7-30 days).
        """
        history = []
        curr = date_from
        while curr <= date_to:
            day_stats = await self.get_stats(school_id, curr, total_users, user_type)
            history.append(day_stats)
            curr += timedelta(days=1)
        return history

    # ------------------------------------------------------------------
    # student detail
    # ------------------------------------------------------------------

    async def get_student_records(
        self,
        school_id: int,
        student_id: int,
        target_date: Optional[date] = None,
    ) -> list[dict]:
        """
        Get all attendance records for a specific student, optionally filtered by date.
        Sorted chronologically (oldest first, for timeline display).
        """
        conditions = [
            AttendanceRecord.school_id == school_id,
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.is_deleted == False,  # noqa: E712
        ]

        if target_date is not None:
            start_utc, end_utc = self._day_boundaries(target_date)
            conditions.append(AttendanceRecord.occurred_at >= start_utc)
            conditions.append(AttendanceRecord.occurred_at < end_utc)

        q = (
            select(AttendanceRecord)
            .options(
                selectinload(AttendanceRecord.student).selectinload(Student.class_),
                selectinload(AttendanceRecord.student).selectinload(Student.stream),
                selectinload(AttendanceRecord.device),
            )
            .where(and_(*conditions))
            .order_by(AttendanceRecord.occurred_at.asc())
        )
        result = await self.db.execute(q)
        records = result.scalars().all()
        return [self._to_event_dict(r) for r in records]

    # ------------------------------------------------------------------
    # mapping helper
    # ------------------------------------------------------------------

    @staticmethod
    def _student_class_display(student: Student) -> Optional[str]:
        if not student:
            return None
        ac = getattr(student, "class_", None)
        class_name = ac.name if ac is not None else None
        st = getattr(student, "stream", None)
        stream_name = st.name if st is not None else None
        if class_name and stream_name:
            return f"{class_name} / {stream_name}"
        return class_name or stream_name

    def _student_filters(
        self,
        class_id: Optional[int],
        stream_id: Optional[int],
    ) -> list:
        conds = []
        if class_id is not None:
            conds.append(Student.class_id == class_id)
        if stream_id is not None:
            conds.append(Student.stream_id == stream_id)
        return conds

    async def count_students_enrolled(
        self,
        school_id: int,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
    ) -> int:
        conds = [
            Student.school_id == school_id,
            Student.is_deleted == False,  # noqa: E712
            *self._student_filters(class_id, stream_id),
        ]
        q = select(func.count(Student.id)).where(and_(*conds))
        return (await self.db.execute(q)).scalar_one()

    async def count_students_with_in_today(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
    ) -> int:
        start_utc, end_utc = self._day_boundaries(target_date)
        st_filters = self._student_filters(class_id, stream_id)
        q = (
            select(func.count(distinct(Student.id)))
            .select_from(Student)
            .join(
                AttendanceRecord,
                and_(
                    AttendanceRecord.student_id == Student.id,
                    AttendanceRecord.school_id == school_id,
                    AttendanceRecord.is_deleted == False,  # noqa: E712
                    AttendanceRecord.occurred_at >= start_utc,
                    AttendanceRecord.occurred_at < end_utc,
                    AttendanceRecord.event_type == EventType.IN,
                ),
            )
            .where(
                Student.school_id == school_id,
                Student.is_deleted == False,  # noqa: E712
                *st_filters,
            )
        )
        return (await self.db.execute(q)).scalar_one()

    async def count_students_currently_in(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        presence_basis: PresenceBasis = "session",
    ) -> int:
        st_filters = self._student_filters(class_id, stream_id)
        if presence_basis == "session":
            last = self._student_session_gate_subquery(school_id)
            q = (
                select(func.count())
                .select_from(Student)
                .join(last, last.c.sid == Student.id)
                .where(
                    Student.school_id == school_id,
                    Student.is_deleted == False,  # noqa: E712
                    last.c.event_type == EventType.IN,
                    *st_filters,
                )
            )
            return (await self.db.execute(q)).scalar_one()

        start_utc, end_utc = self._day_boundaries(target_date)
        subq = (
            select(
                AttendanceRecord.student_id.label("sid"),
                func.max(AttendanceRecord.occurred_at).label("max_ts"),
            )
            .where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.is_deleted == False,  # noqa: E712
                AttendanceRecord.student_id.isnot(None),
                AttendanceRecord.occurred_at >= start_utc,
                AttendanceRecord.occurred_at < end_utc,
            )
            .group_by(AttendanceRecord.student_id)
        ).subquery()

        q = (
            select(func.count())
            .select_from(subq)
            .join(
                AttendanceRecord,
                and_(
                    AttendanceRecord.student_id == subq.c.sid,
                    AttendanceRecord.occurred_at == subq.c.max_ts,
                ),
            )
            .join(Student, Student.id == AttendanceRecord.student_id)
            .where(
                Student.school_id == school_id,
                Student.is_deleted == False,  # noqa: E712
                AttendanceRecord.event_type == EventType.IN,
                *st_filters,
            )
        )
        return (await self.db.execute(q)).scalar_one()

    async def list_students_currently_in(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        presence_basis: PresenceBasis = "session",
    ) -> list[dict]:
        st_filters = self._student_filters(class_id, stream_id)
        if presence_basis == "session":
            last = self._student_session_gate_subquery(school_id)
            q = (
                select(Student, last.c.occurred_at, Device.name)
                .join(last, last.c.sid == Student.id)
                .outerjoin(Device, Device.id == last.c.device_id)
                .options(selectinload(Student.class_), selectinload(Student.stream))
                .where(
                    Student.school_id == school_id,
                    Student.is_deleted == False,  # noqa: E712
                    last.c.event_type == EventType.IN,
                    *st_filters,
                )
                .order_by(Student.first_name, Student.last_name)
            )
            result = await self.db.execute(q)
            return [
                {
                    "student_id": st.id,
                    "full_name": f"{st.first_name} {st.last_name}",
                    "admission_number": st.admission_number,
                    "class_name": self._student_class_display(st),
                    "last_event_at": oa,
                    "device_name": dev_name or "Unknown Device",
                }
                for st, oa, dev_name in result.all()
            ]

        start_utc, end_utc = self._day_boundaries(target_date)
        subq = (
            select(
                AttendanceRecord.student_id.label("sid"),
                func.max(AttendanceRecord.occurred_at).label("max_ts"),
            )
            .where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.is_deleted == False,  # noqa: E712
                AttendanceRecord.student_id.isnot(None),
                AttendanceRecord.occurred_at >= start_utc,
                AttendanceRecord.occurred_at < end_utc,
            )
            .group_by(AttendanceRecord.student_id)
        ).subquery()

        q = (
            select(AttendanceRecord, Student)
            .join(
                subq,
                and_(
                    AttendanceRecord.student_id == subq.c.sid,
                    AttendanceRecord.occurred_at == subq.c.max_ts,
                ),
            )
            .join(Student, Student.id == AttendanceRecord.student_id)
            .options(
                selectinload(Student.class_),
                selectinload(Student.stream),
                selectinload(AttendanceRecord.device),
            )
            .where(
                Student.school_id == school_id,
                Student.is_deleted == False,  # noqa: E712
                AttendanceRecord.event_type == EventType.IN,
                *st_filters,
            )
            .order_by(Student.first_name, Student.last_name)
        )
        result = await self.db.execute(q)
        seen: set[int] = set()
        out: list[dict] = []
        for ar, st in result.all():
            if st.id in seen:
                continue
            seen.add(st.id)
            device = ar.device
            out.append(
                {
                    "student_id": st.id,
                    "full_name": f"{st.first_name} {st.last_name}",
                    "admission_number": st.admission_number,
                    "class_name": self._student_class_display(st),
                    "last_event_at": ar.occurred_at,
                    "device_name": device.name if device else "Unknown Device",
                }
            )
        return out

    async def list_students_absent_no_check_in(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
    ) -> list[dict]:
        start_utc, end_utc = self._day_boundaries(target_date)
        st_filters = self._student_filters(class_id, stream_id)
        has_in = exists().where(
            AttendanceRecord.student_id == Student.id,
            AttendanceRecord.school_id == school_id,
            AttendanceRecord.is_deleted == False,  # noqa: E712
            AttendanceRecord.student_id.isnot(None),
            AttendanceRecord.occurred_at >= start_utc,
            AttendanceRecord.occurred_at < end_utc,
            AttendanceRecord.event_type == EventType.IN,
        )
        q = (
            select(Student)
            .options(selectinload(Student.class_), selectinload(Student.stream))
            .where(
                Student.school_id == school_id,
                Student.is_deleted == False,  # noqa: E712
                ~has_in,
                *st_filters,
            )
            .order_by(Student.first_name, Student.last_name)
        )
        result = await self.db.execute(q)
        students = result.scalars().all()
        return [
            {
                "student_id": s.id,
                "full_name": f"{s.first_name} {s.last_name}",
                "admission_number": s.admission_number,
                "class_name": self._student_class_display(s),
            }
            for s in students
        ]

    def _student_last_event_subquery(self, school_id: int, start_utc, end_utc):
        rn = func.row_number().over(
            partition_by=AttendanceRecord.student_id,
            order_by=AttendanceRecord.occurred_at.desc(),
        ).label("rn")
        inner = (
            select(
                AttendanceRecord.student_id.label("sid"),
                AttendanceRecord.event_type,
                AttendanceRecord.occurred_at,
                AttendanceRecord.device_id,
                rn,
            )
            .where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.is_deleted == False,  # noqa: E712
                AttendanceRecord.student_id.isnot(None),
                AttendanceRecord.occurred_at >= start_utc,
                AttendanceRecord.occurred_at < end_utc,
            )
        ).subquery()
        return (
            select(inner.c.sid, inner.c.event_type, inner.c.occurred_at, inner.c.device_id)
            .where(inner.c.rn == 1)
            .subquery()
        )

    def _teacher_last_event_subquery(self, school_id: int, start_utc, end_utc):
        rn = func.row_number().over(
            partition_by=AttendanceRecord.teacher_id,
            order_by=AttendanceRecord.occurred_at.desc(),
        ).label("rn")
        inner = (
            select(
                AttendanceRecord.teacher_id.label("tid"),
                AttendanceRecord.event_type,
                AttendanceRecord.occurred_at,
                AttendanceRecord.device_id,
                rn,
            )
            .where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.is_deleted == False,  # noqa: E712
                AttendanceRecord.teacher_id.isnot(None),
                AttendanceRecord.occurred_at >= start_utc,
                AttendanceRecord.occurred_at < end_utc,
            )
        ).subquery()
        return (
            select(inner.c.tid, inner.c.event_type, inner.c.occurred_at, inner.c.device_id)
            .where(inner.c.rn == 1)
            .subquery()
        )

    def _student_session_gate_subquery(self, school_id: int):
        """
        Last IN or OUT event per student (all time). Ignores DUPLICATE/UNKNOWN so
        double-taps and ambiguous reads do not flip boarding-style presence.
        """
        rn = (
            func.row_number()
            .over(
                partition_by=AttendanceRecord.student_id,
                order_by=(AttendanceRecord.occurred_at.desc(), AttendanceRecord.id.desc()),
            )
            .label("rn")
        )
        inner = (
            select(
                AttendanceRecord.student_id.label("sid"),
                AttendanceRecord.event_type,
                AttendanceRecord.occurred_at,
                AttendanceRecord.device_id,
                rn,
            )
            .where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.is_deleted == False,  # noqa: E712
                AttendanceRecord.student_id.isnot(None),
                AttendanceRecord.event_type.in_((EventType.IN, EventType.OUT)),
            )
        ).subquery()
        return (
            select(inner.c.sid, inner.c.event_type, inner.c.occurred_at, inner.c.device_id)
            .where(inner.c.rn == 1)
            .subquery()
        )

    def _teacher_session_gate_subquery(self, school_id: int):
        """Last IN or OUT per teacher (all time), ignoring DUPLICATE/UNKNOWN."""
        rn = (
            func.row_number()
            .over(
                partition_by=AttendanceRecord.teacher_id,
                order_by=(AttendanceRecord.occurred_at.desc(), AttendanceRecord.id.desc()),
            )
            .label("rn")
        )
        inner = (
            select(
                AttendanceRecord.teacher_id.label("tid"),
                AttendanceRecord.event_type,
                AttendanceRecord.occurred_at,
                AttendanceRecord.device_id,
                rn,
            )
            .where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.is_deleted == False,  # noqa: E712
                AttendanceRecord.teacher_id.isnot(None),
                AttendanceRecord.event_type.in_((EventType.IN, EventType.OUT)),
            )
        ).subquery()
        return (
            select(inner.c.tid, inner.c.event_type, inner.c.occurred_at, inner.c.device_id)
            .where(inner.c.rn == 1)
            .subquery()
        )

    async def list_students_off_premises(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        presence_basis: PresenceBasis = "session",
    ) -> list[dict]:
        """Off premises: daily = last tap today not IN; session = last IN/OUT ever not IN."""
        st_filters = self._student_filters(class_id, stream_id)
        if presence_basis == "session":
            last = self._student_session_gate_subquery(school_id)
        else:
            start_utc, end_utc = self._day_boundaries(target_date)
            last = self._student_last_event_subquery(school_id, start_utc, end_utc)
        q = (
            select(Student, last.c.event_type, last.c.occurred_at, Device.name)
            .outerjoin(last, last.c.sid == Student.id)
            .outerjoin(Device, Device.id == last.c.device_id)
            .options(selectinload(Student.class_), selectinload(Student.stream))
            .where(
                Student.school_id == school_id,
                Student.is_deleted == False,  # noqa: E712
                or_(last.c.event_type.is_(None), last.c.event_type != EventType.IN),
                *st_filters,
            )
            .order_by(Student.first_name, Student.last_name)
        )
        result = await self.db.execute(q)
        out: list[dict] = []
        for row in result.all():
            s, et, oa, dev_name = row[0], row[1], row[2], row[3]
            out.append(
                {
                    "student_id": s.id,
                    "full_name": f"{s.first_name} {s.last_name}",
                    "admission_number": s.admission_number,
                    "class_name": self._student_class_display(s),
                    "last_event_type": et,
                    "last_event_at": oa,
                    "device_name": dev_name or "Unknown Device",
                }
            )
        return out

    async def count_teachers_enrolled(self, school_id: int) -> int:
        q = select(func.count(Teacher.id)).where(
            Teacher.school_id == school_id,
            Teacher.is_deleted == False,  # noqa: E712
        )
        return (await self.db.execute(q)).scalar_one()

    async def count_teachers_currently_in(
        self,
        school_id: int,
        target_date: date,
        *,
        presence_basis: PresenceBasis = "session",
    ) -> int:
        if presence_basis == "session":
            last = self._teacher_session_gate_subquery(school_id)
            q = (
                select(func.count())
                .select_from(Teacher)
                .join(last, last.c.tid == Teacher.id)
                .where(
                    Teacher.school_id == school_id,
                    Teacher.is_deleted == False,  # noqa: E712
                    last.c.event_type == EventType.IN,
                )
            )
            return (await self.db.execute(q)).scalar_one()

        start_utc, end_utc = self._day_boundaries(target_date)
        subq = (
            select(
                AttendanceRecord.teacher_id.label("tid"),
                func.max(AttendanceRecord.occurred_at).label("max_ts"),
            )
            .where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.is_deleted == False,  # noqa: E712
                AttendanceRecord.teacher_id.isnot(None),
                AttendanceRecord.occurred_at >= start_utc,
                AttendanceRecord.occurred_at < end_utc,
            )
            .group_by(AttendanceRecord.teacher_id)
        ).subquery()
        q = (
            select(func.count())
            .select_from(subq)
            .join(
                AttendanceRecord,
                and_(
                    AttendanceRecord.teacher_id == subq.c.tid,
                    AttendanceRecord.occurred_at == subq.c.max_ts,
                ),
            )
            .join(Teacher, Teacher.id == AttendanceRecord.teacher_id)
            .where(
                Teacher.school_id == school_id,
                Teacher.is_deleted == False,  # noqa: E712
                AttendanceRecord.event_type == EventType.IN,
            )
        )
        return (await self.db.execute(q)).scalar_one()

    async def list_teachers_currently_in(
        self,
        school_id: int,
        target_date: date,
        *,
        presence_basis: PresenceBasis = "session",
    ) -> list[dict]:
        if presence_basis == "session":
            last = self._teacher_session_gate_subquery(school_id)
            q = (
                select(Teacher, last.c.event_type, last.c.occurred_at, Device.name)
                .join(last, last.c.tid == Teacher.id)
                .outerjoin(Device, Device.id == last.c.device_id)
                .where(
                    Teacher.school_id == school_id,
                    Teacher.is_deleted == False,  # noqa: E712
                    last.c.event_type == EventType.IN,
                )
                .order_by(Teacher.first_name, Teacher.last_name)
            )
            result = await self.db.execute(q)
            out: list[dict] = []
            for t, et, oa, dev_name in result.all():
                subj = t.subject if isinstance(t.subject, list) else None
                out.append(
                    {
                        "id": t.id,
                        "first_name": t.first_name,
                        "last_name": t.last_name,
                        "employee_id": t.employee_id,
                        "phone": t.phone,
                        "email": t.email,
                        "subject": subj,
                        "department": t.department,
                        "is_active": t.is_active,
                        "last_event_type": et,
                        "last_event_at": oa,
                        "device_name": dev_name or "Unknown Device",
                    }
                )
            return out

        start_utc, end_utc = self._day_boundaries(target_date)
        subq = (
            select(
                AttendanceRecord.teacher_id.label("tid"),
                func.max(AttendanceRecord.occurred_at).label("max_ts"),
            )
            .where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.is_deleted == False,  # noqa: E712
                AttendanceRecord.teacher_id.isnot(None),
                AttendanceRecord.occurred_at >= start_utc,
                AttendanceRecord.occurred_at < end_utc,
            )
            .group_by(AttendanceRecord.teacher_id)
        ).subquery()
        q = (
            select(AttendanceRecord, Teacher)
            .join(
                subq,
                and_(
                    AttendanceRecord.teacher_id == subq.c.tid,
                    AttendanceRecord.occurred_at == subq.c.max_ts,
                ),
            )
            .join(Teacher, Teacher.id == AttendanceRecord.teacher_id)
            .options(selectinload(AttendanceRecord.device))
            .where(
                Teacher.school_id == school_id,
                Teacher.is_deleted == False,  # noqa: E712
                AttendanceRecord.event_type == EventType.IN,
            )
            .order_by(Teacher.first_name, Teacher.last_name)
        )
        result = await self.db.execute(q)
        seen: set[int] = set()
        out = []
        for ar, t in result.all():
            if t.id in seen:
                continue
            seen.add(t.id)
            device = ar.device
            out.append(
                {
                    "id": t.id,
                    "first_name": t.first_name,
                    "last_name": t.last_name,
                    "employee_id": t.employee_id,
                    "phone": t.phone,
                    "email": t.email,
                    "subject": t.subject if isinstance(t.subject, list) else None,
                    "department": t.department,
                    "is_active": t.is_active,
                    "last_event_type": ar.event_type,
                    "last_event_at": ar.occurred_at,
                    "device_name": device.name if device else "Unknown Device",
                }
            )
        return out

    async def list_teachers_off_premises(
        self,
        school_id: int,
        target_date: date,
        *,
        presence_basis: PresenceBasis = "session",
    ) -> list[dict]:
        if presence_basis == "session":
            last = self._teacher_session_gate_subquery(school_id)
        else:
            start_utc, end_utc = self._day_boundaries(target_date)
            last = self._teacher_last_event_subquery(school_id, start_utc, end_utc)
        q = (
            select(Teacher, last.c.event_type, last.c.occurred_at, Device.name)
            .outerjoin(last, last.c.tid == Teacher.id)
            .outerjoin(Device, Device.id == last.c.device_id)
            .where(
                Teacher.school_id == school_id,
                Teacher.is_deleted == False,  # noqa: E712
                or_(last.c.event_type.is_(None), last.c.event_type != EventType.IN),
            )
            .order_by(Teacher.first_name, Teacher.last_name)
        )
        result = await self.db.execute(q)
        out: list[dict] = []
        for t, et, oa, dev_name in result.all():
            subj = t.subject if isinstance(t.subject, list) else None
            out.append(
                {
                    "id": t.id,
                    "first_name": t.first_name,
                    "last_name": t.last_name,
                    "employee_id": t.employee_id,
                    "phone": t.phone,
                    "email": t.email,
                    "subject": subj,
                    "department": t.department,
                    "is_active": t.is_active,
                    "last_event_type": et,
                    "last_event_at": oa,
                    "device_name": dev_name or "Unknown Device",
                }
            )
        return out

    async def list_teachers_roster_page(
        self,
        school_id: int,
        target_date: date,
        *,
        presence: Literal["all", "in", "out"] = "all",
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 24,
        presence_basis: PresenceBasis = "session",
    ) -> tuple[list[dict], int]:
        """Paginated teachers with optional filter by last tap (IN = on premises)."""
        if presence_basis == "session":
            last = self._teacher_session_gate_subquery(school_id)
        else:
            start_utc, end_utc = self._day_boundaries(target_date)
            last = self._teacher_last_event_subquery(school_id, start_utc, end_utc)

        teacher_conds = [
            Teacher.school_id == school_id,
            Teacher.is_deleted == False,  # noqa: E712
        ]
        if search:
            pat = f"%{search}%"
            teacher_conds.append(
                or_(
                    Teacher.first_name.ilike(pat),
                    Teacher.last_name.ilike(pat),
                    Teacher.employee_id.ilike(pat),
                    Teacher.phone.ilike(pat),
                )
            )

        presence_cond = None
        if presence == "in":
            presence_cond = last.c.event_type == EventType.IN
        elif presence == "out":
            presence_cond = or_(last.c.event_type.is_(None), last.c.event_type != EventType.IN)

        count_q = (
            select(func.count(Teacher.id))
            .select_from(Teacher)
            .outerjoin(last, last.c.tid == Teacher.id)
            .where(and_(*teacher_conds))
        )
        if presence_cond is not None:
            count_q = count_q.where(presence_cond)
        total = (await self.db.execute(count_q)).scalar_one()

        data_q = (
            select(Teacher, last.c.event_type, last.c.occurred_at, Device.name)
            .outerjoin(last, last.c.tid == Teacher.id)
            .outerjoin(Device, Device.id == last.c.device_id)
            .where(and_(*teacher_conds))
        )
        if presence_cond is not None:
            data_q = data_q.where(presence_cond)
        data_q = (
            data_q.order_by(Teacher.last_name, Teacher.first_name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(data_q)
        items: list[dict] = []
        for t, et, oa, dev_name in result.all():
            subj = t.subject if isinstance(t.subject, list) else None
            items.append(
                {
                    "id": t.id,
                    "first_name": t.first_name,
                    "last_name": t.last_name,
                    "employee_id": t.employee_id,
                    "phone": t.phone,
                    "email": t.email,
                    "subject": subj,
                    "department": t.department,
                    "is_active": t.is_active,
                    "last_event_type": et,
                    "last_event_at": oa,
                    "device_name": dev_name or "Unknown Device",
                }
            )
        return items, total

    @staticmethod
    def _to_event_dict(record: AttendanceRecord) -> dict:
        """Convert an ORM record (with loaded relationships) to a display dict."""
        student = record.student
        teacher = record.teacher
        device = record.device

        student_name = None
        admission_number = None
        class_name = None
        if student:
            student_name = f"{student.first_name} {student.last_name}"
            admission_number = student.admission_number
            ac = getattr(student, "class_", None)
            if ac is not None:
                class_name = ac.name
            st = getattr(student, "stream", None)
            if st is not None and class_name:
                class_name = f"{class_name} / {st.name}"
            elif st is not None:
                class_name = st.name

        teacher_name = None
        employee_id = None
        department = None
        if teacher:
            teacher_name = f"{teacher.first_name} {teacher.last_name}"
            employee_id = teacher.employee_id
            department = teacher.department

        return {
            "id": record.id,
            "student_id": record.student_id,
            "student_name": student_name,
            "admission_number": admission_number,
            "teacher_id": record.teacher_id,
            "teacher_name": teacher_name,
            "employee_id": employee_id,
            "department": department,
            "class_name": class_name,
            "device_id": record.device_id,
            "device_name": device.name if device else "Unknown Device",
            "event_type": record.event_type,
            "is_boarding": student.is_boarding if student else False,
            "occurred_at": record.occurred_at,
        }
