"""Pydantic schemas for Enrollment."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class EnrollmentStatus(str, Enum):
    """Enrollment status enumeration for Pydantic validation."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EnrollmentSessionBase(BaseModel):
    """Base schema for EnrollmentSession with common fields."""

    student_id: Optional[int] = Field(None, description="Student ID (one of student_id or teacher_id required)")
    teacher_id: Optional[int] = Field(None, description="Teacher ID (one of student_id or teacher_id required)")
    device_id: int = Field(..., description="Device ID")
    finger_id: int = Field(..., ge=0, le=9, description="Finger ID (0-9)")
    status: EnrollmentStatus = Field(default=EnrollmentStatus.PENDING, description="Enrollment status")


class EnrollmentSessionCreate(EnrollmentSessionBase):
    """Schema for creating a new enrollment session."""

    school_id: int = Field(..., description="School ID")
    session_id: Optional[str] = Field(None, description="Session ID (auto-generated if not provided)")


class EnrollmentSessionUpdate(BaseModel):
    """Schema for updating enrollment session."""

    status: Optional[EnrollmentStatus] = None
    error_message: Optional[str] = None
    template_data: Optional[str] = None
    quality_score: Optional[int] = Field(None, ge=0, le=100, description="Quality score (0-100)")
    completed_at: Optional[datetime] = None


class EnrollmentSessionResponse(BaseModel):
    """Schema for enrollment session response."""

    id: int
    session_id: str
    student_id: Optional[int] = None
    teacher_id: Optional[int] = None
    device_id: int
    finger_id: int
    school_id: int
    status: EnrollmentStatus
    error_message: Optional[str] = None
    quality_score: Optional[int] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EnrollmentStartRequest(BaseModel):
    """Schema for enrollment start request (student)."""

    student_id: int = Field(..., description="Student ID")
    device_id: int = Field(..., description="Device ID")
    finger_id: int = Field(..., ge=0, le=9, description="Finger ID (0-9)")


class EnrollmentStartRequestTeacher(BaseModel):
    """Schema for teacher enrollment start request."""

    teacher_id: int = Field(..., description="Teacher ID")
    device_id: int = Field(..., description="Device ID")
    finger_id: int = Field(..., ge=0, le=9, description="Finger ID (0-9)")


class EnrollmentStartResponse(BaseModel):
    """Schema for enrollment start response."""

    session_id: str
    student_id: Optional[int] = None
    teacher_id: Optional[int] = None
    device_id: int
    finger_id: int
    status: EnrollmentStatus
    started_at: datetime

    class Config:
        from_attributes = True


class EnrolledFingersResponse(BaseModel):
    """Schema for list of enrolled finger IDs on a device for a student."""

    device_id: int
    student_id: int
    finger_ids: list[int] = Field(..., description="Finger indices (0-9) that have templates on the device")


class EnrollmentRecordSummary(BaseModel):
    """Summary of a completed enrollment for list APIs (student or device enrollments)."""

    id: int
    session_id: str
    student_id: Optional[int] = None
    teacher_id: Optional[int] = None
    device_id: int
    finger_id: int
    quality_score: Optional[int] = None
    completed_at: Optional[datetime] = None
    has_template: bool = Field(description="Whether template is stored for sync")
    student_name: Optional[str] = None
    teacher_name: Optional[str] = None
    device_name: Optional[str] = None

    class Config:
        from_attributes = True


class EnrollmentListResponse(BaseModel):
    """List of enrollment records for UI and sync readiness."""

    enrollments: list[EnrollmentRecordSummary]


class EnrollmentCountResponse(BaseModel):
    """Summary response containing successful enrollment count."""

    successful_enrollments: int = Field(
        ...,
        ge=0,
        description="Number of completed enrollment sessions for the school",
    )
