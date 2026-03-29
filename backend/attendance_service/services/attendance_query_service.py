"""Service layer for querying attendance records."""

import math
from datetime import date
from typing import Optional, Literal

PresenceBasis = Literal["daily", "session"]

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from attendance_service.repositories.attendance_query_repository import AttendanceQueryRepository
from school_service.models.student import Student
from school_service.models.teacher import Teacher
from shared.schemas.attendance import (
    AttendanceEventResponse,
    PaginatedAttendanceResponse,
    AttendanceStatsResponse,
    StudentRosterItemResponse,
    StudentAbsentItemResponse,
    StudentRosterSummaryResponse,
    StudentOffPremisesItemResponse,
    TeacherPresenceRowResponse,
    PaginatedTeacherRosterResponse,
    PresenceOverviewResponse,
)


class AttendanceQueryService:
    """Business logic for attendance queries."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AttendanceQueryRepository(db)

    async def list_attendance(
        self,
        school_id: int,
        *,
        target_date: Optional[date] = None,
        user_type: Optional[Literal["student", "teacher"]] = None,
        student_id: Optional[int] = None,
        teacher_id: Optional[int] = None,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        device_id: Optional[int] = None,
        event_type: Optional[str] = None,
        search: Optional[str] = None,
        is_boarding: Optional[bool] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> PaginatedAttendanceResponse:
        """Get paginated, filtered attendance records."""
        items, total = await self.repo.list_records(
            school_id=school_id,
            target_date=target_date,
            user_type=user_type,
            student_id=student_id,
            teacher_id=teacher_id,
            class_id=class_id,
            stream_id=stream_id,
            device_id=device_id,
            event_type=event_type,
            is_boarding=is_boarding,
            search=search,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return PaginatedAttendanceResponse(
            items=[AttendanceEventResponse(**item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_stats(
        self,
        school_id: int,
        target_date: date,
        user_type: Literal["student", "teacher"] = "student",
    ) -> AttendanceStatsResponse:
        """Get attendance summary stats for a date."""
        if user_type == "student":
            # Count total active students in this school
            total_users = (
                await self.db.execute(
                    select(func.count(Student.id)).where(
                        Student.school_id == school_id,
                        Student.is_deleted == False,  # noqa: E712
                    )
                )
            ).scalar_one()
        else:
            # Count total active teachers in this school
            total_users = (
                await self.db.execute(
                    select(func.count(Teacher.id)).where(
                        Teacher.school_id == school_id,
                        Teacher.is_deleted == False,  # noqa: E712
                    )
                )
            ).scalar_one()

        stats = await self.repo.get_stats(school_id, target_date, total_users, user_type)
        return AttendanceStatsResponse(**stats)

    async def get_history_stats(
        self,
        school_id: int,
        date_from: date,
        date_to: date,
        user_type: Literal["student", "teacher"] = "student",
    ) -> list[AttendanceStatsResponse]:
        """Get attendance summary stats for each day in a range."""
        if user_type == "student":
            total_users = (
                await self.db.execute(
                    select(func.count(Student.id)).where(
                        Student.school_id == school_id,
                        Student.is_deleted == False,  # noqa: E712
                    )
                )
            ).scalar_one()
        else:
            total_users = (
                await self.db.execute(
                    select(func.count(Teacher.id)).where(
                        Teacher.school_id == school_id,
                        Teacher.is_deleted == False,  # noqa: E712
                    )
                )
            ).scalar_one()

        history = await self.repo.get_stats_range(
            school_id, date_from, date_to, total_users, user_type
        )
        return [AttendanceStatsResponse(**stats) for stats in history]

    async def get_student_attendance(
        self,
        school_id: int,
        student_id: int,
        target_date: Optional[date] = None,
    ) -> list[AttendanceEventResponse]:
        """Get attendance records for a specific student."""
        items = await self.repo.get_student_records(school_id, student_id, target_date)
        return [AttendanceEventResponse(**item) for item in items]

    async def get_roster_summary(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        presence_basis: PresenceBasis = "session",
    ) -> StudentRosterSummaryResponse:
        total = await self.repo.count_students_enrolled(
            school_id, class_id=class_id, stream_id=stream_id
        )
        with_in = await self.repo.count_students_with_in_today(
            school_id, target_date, class_id=class_id, stream_id=stream_id
        )
        cur_in = await self.repo.count_students_currently_in(
            school_id,
            target_date,
            class_id=class_id,
            stream_id=stream_id,
            presence_basis=presence_basis,
        )
        absent = max(0, total - with_in)
        return StudentRosterSummaryResponse(
            target_date=target_date,
            total_students=total,
            with_check_in_today=with_in,
            currently_in_school=cur_in,
            absent_no_check_in=absent,
        )

    async def list_students_currently_in(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        presence_basis: PresenceBasis = "session",
    ) -> list[StudentRosterItemResponse]:
        rows = await self.repo.list_students_currently_in(
            school_id,
            target_date,
            class_id=class_id,
            stream_id=stream_id,
            presence_basis=presence_basis,
        )
        return [StudentRosterItemResponse(**r) for r in rows]

    async def list_students_absent(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
    ) -> list[StudentAbsentItemResponse]:
        rows = await self.repo.list_students_absent_no_check_in(
            school_id, target_date, class_id=class_id, stream_id=stream_id
        )
        return [StudentAbsentItemResponse(**r) for r in rows]

    async def list_students_off_premises(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
    ) -> list[StudentOffPremisesItemResponse]:
        rows = await self.repo.list_students_off_premises(
            school_id, target_date, class_id=class_id, stream_id=stream_id
        )
        return [StudentOffPremisesItemResponse(**r) for r in rows]

    async def list_teachers_currently_in(
        self,
        school_id: int,
        target_date: date,
        *,
        presence_basis: PresenceBasis = "session",
    ) -> list[TeacherPresenceRowResponse]:
        rows = await self.repo.list_teachers_currently_in(
            school_id, target_date, presence_basis=presence_basis
        )
        return [TeacherPresenceRowResponse(**r) for r in rows]

    async def list_teachers_off_premises(
        self,
        school_id: int,
        target_date: date,
        *,
        presence_basis: PresenceBasis = "session",
    ) -> list[TeacherPresenceRowResponse]:
        rows = await self.repo.list_teachers_off_premises(
            school_id, target_date, presence_basis=presence_basis
        )
        return [TeacherPresenceRowResponse(**r) for r in rows]

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
    ) -> PaginatedTeacherRosterResponse:
        items, total = await self.repo.list_teachers_roster_page(
            school_id,
            target_date,
            presence=presence,
            search=search,
            page=page,
            page_size=page_size,
            presence_basis=presence_basis,
        )
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        return PaginatedTeacherRosterResponse(
            items=[TeacherPresenceRowResponse(**x) for x in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_presence_overview(
        self,
        school_id: int,
        target_date: date,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        presence_basis: PresenceBasis = "session",
    ) -> PresenceOverviewResponse:
        total_st = await self.repo.count_students_enrolled(
            school_id, class_id=class_id, stream_id=stream_id
        )
        on_st = await self.repo.count_students_currently_in(
            school_id,
            target_date,
            class_id=class_id,
            stream_id=stream_id,
            presence_basis=presence_basis,
        )
        off_st = max(0, total_st - on_st)
        total_t = await self.repo.count_teachers_enrolled(school_id)
        on_t = await self.repo.count_teachers_currently_in(
            school_id, target_date, presence_basis=presence_basis
        )
        off_t = max(0, total_t - on_t)
        return PresenceOverviewResponse(
            target_date=target_date,
            students_on_premises=on_st,
            students_off_premises=off_st,
            teachers_on_premises=on_t,
            teachers_off_premises=off_t,
            total_students=total_st,
            total_teachers=total_t,
        )
