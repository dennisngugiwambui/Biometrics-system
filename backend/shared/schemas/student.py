"""Pydantic schemas for Student."""

from pydantic import BaseModel, EmailStr, Field, model_validator, model_validator
from datetime import date, datetime
from typing import Optional, Any
from enum import Enum

from school_service.models.student import Gender as ModelGender


class Gender(str, Enum):
    """Gender enumeration for Pydantic validation."""

    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class StudentBase(BaseModel):
    """Base schema for Student with common fields."""

    admission_number: str = Field(
        ..., min_length=1, max_length=50, description="Unique admission number per school"
    )
    first_name: str = Field(..., min_length=1, max_length=100, description="Student first name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Student last name")
    date_of_birth: Optional[date] = Field(None, description="Student date of birth")
    gender: Optional[Gender] = Field(None, description="Student gender")
    parent_phone: Optional[str] = Field(
        None, pattern=r"^\+?[0-9]{10,15}$", description="Parent/guardian phone number"
    )
    parent_email: Optional[EmailStr] = Field(None, description="Parent/guardian email address")
    is_boarding: bool = Field(False, description="Whether the student is a boarder")
    access_card_number: Optional[str] = Field(
        None,
        max_length=32,
        description="RFID/access card UID (decimal or hex). Synced to ZKTeco devices as card number.",
    )


class StudentCreate(StudentBase):
    """Schema for creating a new student."""

    school_id: Optional[int] = Field(None, description="ID of the school (auto-assigned from authenticated user)")
    class_id: Optional[int] = Field(None, description="ID of the class (optional)")
    stream_id: Optional[int] = Field(None, description="ID of the stream (optional)")


class StudentUpdate(BaseModel):
    """Schema for updating student information."""

    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    class_id: Optional[int] = None
    stream_id: Optional[int] = None
    parent_phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,15}$")
    parent_email: Optional[EmailStr] = None
    is_boarding: Optional[bool] = None
    access_card_number: Optional[str] = Field(None, max_length=32)
    # Note: admission_number and school_id are immutable


class StudentResponse(StudentBase):
    """Schema for student response."""

    id: int
    school_id: int
    class_id: Optional[int] = None
    stream_id: Optional[int] = None
    class_name: Optional[str] = None
    stream_name: Optional[str] = None
    enrollment_status: str = Field(default="active", description="active | graduated")
    graduated_at: Optional[date] = None
    is_deleted: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaginatedStudentResponse(BaseModel):
    """Paginated response for student list."""

    items: list[StudentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True


class StudentBulkRow(BaseModel):
    """Schema for a single row in bulk import."""

    admission_number: str
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    parent_phone: Optional[str] = None
    parent_email: Optional[EmailStr] = None
    is_boarding: bool = False
    class_name: Optional[str] = None
    stream_name: Optional[str] = None


class StudentBulkImportRequest(BaseModel):
    """Request schema for bulk student import."""

    students: list[StudentBulkRow]


class StudentBulkImportResult(BaseModel):
    """Result schema for bulk student import."""

    total: int
    inserted: int
    updated: int = 0
    skipped: int
    errors: list[str] = []


class CohortPromotionRequest(BaseModel):
    """
    Class ladder: lowest grade first, highest last (e.g. Form 1 … Form 4).

    With ``normalize_ladder_order`` (default), selected classes are split into separate
    Form* and Grade* chains and each chain is sorted by level so click order does not matter.

    With ``use_all_school_chains``, every Form 1–4 and Grade 10–13 style class in the school
    is promoted automatically; ``ladder_class_ids`` may be empty.
    """

    ladder_class_ids: list[int] = Field(default_factory=list)
    use_all_school_chains: bool = False
    normalize_ladder_order: bool = True
    graduate_top_rung: bool = True
    remove_graduates_from_devices: bool = True
    create_target_streams_if_missing: bool = True
    resync_all_devices_after: bool = Field(
        True,
        description="After promotion, push all active students to each device (updates class data).",
    )

    @model_validator(mode="after")
    def _require_ladder_or_auto(self) -> "CohortPromotionRequest":
        if not self.use_all_school_chains and len(self.ladder_class_ids) < 2:
            raise ValueError(
                "Provide at least two ladder_class_ids, or set use_all_school_chains to true."
            )
        return self


class CohortPromotionResponse(BaseModel):
    graduated_count: int
    graduated_student_ids: list[int]
    moved_count: int
    moves_by_step: list[dict[str, Any]]
    chains_executed: int = 1
    alumni_records_created: int = 0
    device_removal: Optional[dict[str, Any]] = None
    device_removal_error: Optional[str] = None
    device_resync: Optional[dict[str, Any]] = None
    device_resync_error: Optional[str] = None


class BulkGraduateRequest(BaseModel):
    class_id: int
    stream_id: Optional[int] = None
    remove_from_devices: bool = True


class BulkGraduateResponse(BaseModel):
    graduated_count: int
    graduated_student_ids: list[int]
    alumni_records_created: int = 0
    device_removal: Optional[dict[str, Any]] = None
    device_removal_error: Optional[str] = None


class BulkRemoveFromDevicesRequest(BaseModel):
    """Remove portal users from all school devices (by student database id = device uid)."""

    student_ids: Optional[list[int]] = None
    class_id: Optional[int] = None
    stream_id: Optional[int] = None
    include_graduated_in_class: bool = Field(
        False,
        description="When using class_id, also match graduated leavers still tagged to that class.",
    )

    @model_validator(mode="after")
    def _need_scope(self) -> "BulkRemoveFromDevicesRequest":
        if self.student_ids and len(self.student_ids) > 0:
            return self
        if self.class_id is not None:
            return self
        raise ValueError("Provide student_ids or class_id (optional stream_id).")

