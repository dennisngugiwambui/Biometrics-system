"""API routes for querying attendance records."""

from datetime import date
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from attendance_service.core.database import get_db
from attendance_service.api.dependencies import get_current_user
from attendance_service.services.attendance_query_service import AttendanceQueryService
from shared.schemas.user import UserResponse
from shared.schemas.attendance import (
    AttendanceEventResponse,
    AttendanceStatsResponse,
    PaginatedAttendanceResponse,
    StudentRosterItemResponse,
    StudentAbsentItemResponse,
    StudentRosterSummaryResponse,
    StudentOffPremisesItemResponse,
    TeacherPresenceRowResponse,
    PaginatedTeacherRosterResponse,
    PresenceOverviewResponse,
)

router = APIRouter(prefix="/api/v1/attendance", tags=["attendance"])


@router.get(
    "",
    response_model=PaginatedAttendanceResponse,
    summary="List attendance records",
    description="""
    Get a paginated list of attendance records with optional filters.
    
    Returns enriched records with student name, admission number, class, and device name.
    Defaults to today's records if no date is specified.
    """,
    responses={
        200: {"description": "Attendance records retrieved successfully"},
    },
)
async def list_attendance(
    target_date: Optional[date] = Query(None, description="Filter by date (YYYY-MM-DD). Defaults to today if omitted."),
    user_type: Optional[Literal["student", "teacher"]] = Query(
        None,
        description="Filter by user type: student or teacher. If omitted, returns both.",
    ),
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    teacher_id: Optional[int] = Query(None, description="Filter by teacher ID"),
    class_id: Optional[int] = Query(None, description="Filter by class ID"),
    stream_id: Optional[int] = Query(None, description="Filter by stream ID"),
    device_id: Optional[int] = Query(None, description="Filter by device ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type: IN, OUT, or UNKNOWN"),
    search: Optional[str] = Query(None, description="Search by student name or admission number"),
    date_from: Optional[date] = Query(None, description="Date range start (YYYY-MM-DD). Use with date_to."),
    date_to: Optional[date] = Query(None, description="Date range end (YYYY-MM-DD). Use with date_from."),
    is_boarding: Optional[bool] = Query(None, description="Filter by boarding status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page (max 200)"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List attendance records with pagination and filtering."""
    # If date range is provided, skip single-date default
    if date_from is None and date_to is None:
        # Default to today if no date specified
        if target_date is None:
            target_date = date.today()

    # Validate event_type if provided
    if event_type is not None:
        event_type = event_type.upper()
        if event_type not in ("IN", "OUT", "UNKNOWN"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="event_type must be one of: IN, OUT, UNKNOWN",
            )

    service = AttendanceQueryService(db)
    return await service.list_attendance(
        school_id=current_user.school_id,
        target_date=target_date,
        user_type=user_type,
        student_id=student_id,
        teacher_id=teacher_id,
        class_id=class_id,
        stream_id=stream_id,
        device_id=device_id,
        event_type=event_type,
        search=search,
        is_boarding=is_boarding,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/roster/summary",
    response_model=StudentRosterSummaryResponse,
    summary="Roster counts: in school, absent, totals",
    description="""
    Dashboard-friendly counts for the target date (default today).
    **currently_in_school**: by **presence_basis** — `session` = last IN/OUT ever is IN (boarding);
    `daily` = last tap on that calendar day is IN.
    **absent_no_check_in**: enrolled students with no IN event that day (always day-scoped).
    Optional **class_id** / **stream_id** scope the cohort.
    """,
)
async def get_roster_summary(
    target_date: Optional[date] = Query(None, description="Defaults to today"),
    class_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    presence_basis: Literal["daily", "session"] = Query(
        "session",
        description="session = last IN/OUT until OUT (boarding); daily = last tap on calendar day only",
    ),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_date is None:
        target_date = date.today()
    service = AttendanceQueryService(db)
    return await service.get_roster_summary(
        current_user.school_id,
        target_date,
        class_id=class_id,
        stream_id=stream_id,
        presence_basis=presence_basis,
    )


@router.get(
    "/roster/currently-in",
    response_model=list[StudentRosterItemResponse],
    summary="Students currently on premises",
    description="On site by **presence_basis** (default session): last IN/OUT is IN, or last tap on date is IN when daily.",
)
async def list_roster_currently_in(
    target_date: Optional[date] = Query(None),
    class_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    presence_basis: Literal["daily", "session"] = Query("session"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_date is None:
        target_date = date.today()
    service = AttendanceQueryService(db)
    return await service.list_students_currently_in(
        current_user.school_id,
        target_date,
        class_id=class_id,
        stream_id=stream_id,
        presence_basis=presence_basis,
    )


@router.get(
    "/roster/absent",
    response_model=list[StudentAbsentItemResponse],
    summary="Students absent (no check-in)",
    description="Enrolled students with no IN event on the target date.",
)
async def list_roster_absent(
    target_date: Optional[date] = Query(None),
    class_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_date is None:
        target_date = date.today()
    service = AttendanceQueryService(db)
    return await service.list_students_absent(
        current_user.school_id,
        target_date,
        class_id=class_id,
        stream_id=stream_id,
    )


@router.get(
    "/roster/students/off-premises",
    response_model=list[StudentOffPremisesItemResponse],
    summary="Students off premises today",
    description="Last event today is not IN (checked out, unknown, or no taps).",
)
async def list_roster_students_off(
    target_date: Optional[date] = Query(None),
    class_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    presence_basis: Literal["daily", "session"] = Query("session"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_date is None:
        target_date = date.today()
    service = AttendanceQueryService(db)
    return await service.list_students_off_premises(
        current_user.school_id,
        target_date,
        class_id=class_id,
        stream_id=stream_id,
        presence_basis=presence_basis,
    )


@router.get(
    "/roster/teachers/currently-in",
    response_model=list[TeacherPresenceRowResponse],
    summary="Teachers on premises (last tap IN)",
)
async def list_roster_teachers_in(
    target_date: Optional[date] = Query(None),
    presence_basis: Literal["daily", "session"] = Query("session"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_date is None:
        target_date = date.today()
    service = AttendanceQueryService(db)
    return await service.list_teachers_currently_in(
        current_user.school_id, target_date, presence_basis=presence_basis
    )


@router.get(
    "/roster/teachers/off-premises",
    response_model=list[TeacherPresenceRowResponse],
    summary="Teachers off premises today",
)
async def list_roster_teachers_off(
    target_date: Optional[date] = Query(None),
    presence_basis: Literal["daily", "session"] = Query("session"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_date is None:
        target_date = date.today()
    service = AttendanceQueryService(db)
    return await service.list_teachers_off_premises(
        current_user.school_id, target_date, presence_basis=presence_basis
    )


@router.get(
    "/roster/teachers",
    response_model=PaginatedTeacherRosterResponse,
    summary="Teachers with presence filter (paginated)",
    description="Filter by **presence**: `in` (last tap today is IN), `out` (not IN), or `all`.",
)
async def list_teachers_roster(
    target_date: Optional[date] = Query(None),
    presence: Literal["all", "in", "out"] = Query("all"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    presence_basis: Literal["daily", "session"] = Query("session"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_date is None:
        target_date = date.today()
    service = AttendanceQueryService(db)
    return await service.list_teachers_roster_page(
        current_user.school_id,
        target_date,
        presence=presence,
        search=search,
        page=page,
        page_size=page_size,
        presence_basis=presence_basis,
    )


@router.get(
    "/roster/presence-overview",
    response_model=PresenceOverviewResponse,
    summary="Headline in/out counts for students and teachers",
)
async def get_presence_overview(
    target_date: Optional[date] = Query(None),
    class_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    presence_basis: Literal["daily", "session"] = Query("session"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_date is None:
        target_date = date.today()
    service = AttendanceQueryService(db)
    return await service.get_presence_overview(
        current_user.school_id,
        target_date,
        class_id=class_id,
        stream_id=stream_id,
        presence_basis=presence_basis,
    )


@router.get(
    "/stats",
    response_model=AttendanceStatsResponse,
    summary="Get attendance statistics",
    description="""
    Get summary attendance statistics for a given date.
    
    Returns: total events, students currently checked in, checked out, 
    total students in school, and present rate percentage.
    """,
    responses={
        200: {"description": "Attendance stats retrieved successfully"},
    },
)
async def get_attendance_stats(
    target_date: Optional[date] = Query(None, description="Date for stats (YYYY-MM-DD). Defaults to today."),
    user_type: Literal["student", "teacher"] = Query("student", description="Filter by user type: student or teacher"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance summary statistics for a date."""
    if target_date is None:
        target_date = date.today()

    service = AttendanceQueryService(db)
    return await service.get_stats(
        school_id=current_user.school_id,
        target_date=target_date,
        user_type=user_type,
    )


@router.get(
    "/students/{student_id}",
    response_model=list[AttendanceEventResponse],
    summary="Get student attendance records",
    description="""
    Get attendance records for a specific student.
    
    Optionally filter by date. Returns records in chronological order 
    (oldest first) — suitable for timeline display.
    """,
    responses={
        200: {"description": "Student attendance records retrieved successfully"},
    },
)
async def get_student_attendance(
    student_id: int,
    target_date: Optional[date] = Query(None, description="Filter by date (YYYY-MM-DD). Returns all dates if omitted."),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance records for a specific student."""
    service = AttendanceQueryService(db)
    return await service.get_student_attendance(
        school_id=current_user.school_id,
        student_id=student_id,
        target_date=target_date,
    )


@router.get(
    "/history",
    response_model=list[AttendanceStatsResponse],
    summary="Get historical attendance statistics",
    description="""
    Get daily attendance summary statistics over a date range.
    """,
    responses={
        200: {"description": "Historical stats retrieved successfully"},
    },
)
async def get_attendance_history(
    date_from: date = Query(..., description="Range start (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Range end (YYYY-MM-DD)"),
    user_type: Literal["student", "teacher"] = Query("student", description="User type"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get historical summary statistics for a date range."""
    service = AttendanceQueryService(db)
    return await service.get_history_stats(
        school_id=current_user.school_id,
        date_from=date_from,
        date_to=date_to,
        user_type=user_type,
    )
