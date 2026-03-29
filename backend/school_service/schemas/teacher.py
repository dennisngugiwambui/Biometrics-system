"""Pydantic schemas for Teacher records."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
import re


class TeacherBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=7, max_length=20, description="Unique phone per school")
    email: Optional[str] = Field(None, max_length=255)
    subject: Optional[List[str]] = Field(None, description="List of subjects taught")
    department: Optional[str] = Field(None, max_length=150)

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        # Strip spaces
        return v.strip()


class TeacherCreate(TeacherBase):
    """Schema for creating a single teacher."""
    pass


class TeacherBulkRow(BaseModel):
    """One row from a bulk import file — more lenient validation."""
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    subject: Optional[List[str]] = None
    department: Optional[str] = None

    @field_validator("first_name", "last_name", "phone", mode="before")
    @classmethod
    def strip_str(cls, v):
        return str(v).strip() if v is not None else v


class TeacherBulkImportRequest(BaseModel):
    """Body for bulk import endpoint when sending JSON rows."""
    teachers: List[TeacherBulkRow]


class TeacherUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=7, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    subject: Optional[List[str]] = Field(None)
    department: Optional[str] = Field(None, max_length=150)
    is_active: Optional[bool] = None


class TeacherResponse(BaseModel):
    id: int
    school_id: int
    employee_id: Optional[str] = None
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    subject: Optional[List[str]] = None
    department: Optional[str] = None
    is_active: bool
    is_deleted: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_validator("subject", mode="before")
    @classmethod
    def subject_to_list(cls, v: object) -> Optional[List[str]]:
        """Accept subject as list or single string (e.g. from DB stored as string)."""
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            s = v.strip()
            return [s] if s else None
        return None

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class PaginatedTeacherResponse(BaseModel):
    items: List[TeacherResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TeacherBulkImportResult(BaseModel):
    inserted: int
    updated: int = 0
    skipped: int
    errors: List[str] = []
    total: int
