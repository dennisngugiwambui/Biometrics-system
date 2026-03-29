"""Pydantic schemas for Attendance records."""

from datetime import datetime, date
from enum import Enum
from typing import Optional, Any, Union
from pydantic import BaseModel, Field


class EventTypeEnum(str, Enum):
    """Attendance event type."""
    IN = "IN"
    OUT = "OUT"
    UNKNOWN = "UNKNOWN"


class AttendanceRecordCreate(BaseModel):
    """Schema for creating an attendance record (internal use)."""
    school_id: int = Field(..., description="School ID")
    device_id: int = Field(..., description="Device ID")
    student_id: Optional[int] = Field(None, description="Student ID (nullable if not matched)")
    teacher_id: Optional[int] = Field(None, description="Teacher ID (nullable if not matched)")
    device_user_id: str = Field(..., description="User ID from device (uid)")
    occurred_at: datetime = Field(..., description="Timestamp from device")
    event_type: EventTypeEnum = Field(
        default=EventTypeEnum.UNKNOWN,
        description="Event type: IN, OUT, or UNKNOWN",
    )
    raw_payload: Optional[dict[str, Any]] = Field(None, description="Raw event payload from device")


class IngestionSummaryResponse(BaseModel):
    """Response for attendance ingestion endpoint."""
    inserted: int
    skipped: int
    duplicates_filtered: int = Field(default=0, description="Records skipped as duplicate taps")
    total: int


class AttendanceRecordResponse(BaseModel):
    """Schema for attendance record API response (raw, ID-only)."""
    id: int
    school_id: int
    device_id: int
    student_id: Optional[int] = None
    teacher_id: Optional[int] = None
    device_user_id: str
    occurred_at: datetime
    event_type: EventTypeEnum = EventTypeEnum.UNKNOWN
    raw_payload: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ------------------------------------------------------------------
# Enriched response schemas for the Attendance API (display-ready)
# ------------------------------------------------------------------


class AttendanceEventResponse(BaseModel):
    """Enriched attendance record for API display — includes names, not just IDs."""
    id: int
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    admission_number: Optional[str] = None
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    class_name: Optional[str] = None
    is_boarding: bool = False
    device_id: int
    device_name: str
    event_type: EventTypeEnum
    source: Optional[str] = "k40_device"
    occurred_at: datetime

    class Config:
        from_attributes = True


class PaginatedAttendanceResponse(BaseModel):
    """Paginated list of enriched attendance records."""
    items: list[AttendanceEventResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AttendanceStatsResponse(BaseModel):
    """Summary statistics for attendance on a given date."""
    date: date
    total_events: int = 0
    checked_in: int = Field(0, description="Unique users currently checked in (last event is IN)")
    checked_out: int = Field(0, description="Unique users whose last event is OUT")
    total_users: int = Field(0, description="Total users (students or teachers) in school")
    present_rate: float = Field(0.0, description="Percentage of users with at least one IN today")


class AttendanceHistoryResponse(BaseModel):
    """Time-series attendance statistics."""
    items: list[AttendanceStatsResponse]


class StudentRosterItemResponse(BaseModel):
    """Student on premises (last event today is IN)."""

    student_id: int
    full_name: str
    admission_number: str
    class_name: Optional[str] = None
    last_event_at: datetime
    device_name: str = "Unknown Device"


class StudentAbsentItemResponse(BaseModel):
    """Enrolled student with no check-in (IN) on the target date."""

    student_id: int
    full_name: str
    admission_number: str
    class_name: Optional[str] = None


class StudentRosterSummaryResponse(BaseModel):
    """Counts for dashboard cards (optional class/stream scope)."""

    target_date: date
    total_students: int
    with_check_in_today: int = Field(
        0, description="Students who had at least one IN event today"
    )
    currently_in_school: int = Field(
        0, description="Students whose last event today is IN"
    )
    absent_no_check_in: int = Field(
        0, description="Enrolled students with no IN event today"
    )


class StudentOffPremisesItemResponse(BaseModel):
    """Student not on premises: last event today is not IN."""

    student_id: int
    full_name: str
    admission_number: str
    class_name: Optional[str] = None
    last_event_type: Optional[str] = None
    last_event_at: Optional[datetime] = None
    device_name: str = "Unknown Device"


class TeacherPresenceRowResponse(BaseModel):
    """Teacher row with today's last biometric event."""

    id: int
    first_name: str
    last_name: str
    employee_id: Optional[str] = None
    phone: str
    email: Optional[str] = None
    subject: Optional[Union[list[Any], Any]] = None
    department: Optional[str] = None
    is_active: bool = True
    last_event_type: Optional[str] = None
    last_event_at: Optional[datetime] = None
    device_name: Optional[str] = None


class PaginatedTeacherRosterResponse(BaseModel):
    items: list[TeacherPresenceRowResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PresenceOverviewResponse(BaseModel):
    """Headline counts for students and teachers (last tap today)."""

    target_date: date
    students_on_premises: int
    students_off_premises: int
    teachers_on_premises: int
    teachers_off_premises: int
    total_students: int
    total_teachers: int
