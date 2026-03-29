"""Pydantic schemas for School."""

from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional, Literal, Any


class SchoolBase(BaseModel):
    """Base schema for School with common fields."""

    name: str = Field(..., min_length=1, max_length=200, description="School name")
    code: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r"^[A-Za-z0-9-]+$",
        description="Unique school code (letters, numbers, and hyphens only - will be normalized to uppercase)",
    )

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        """Normalize school code to uppercase."""
        return v.upper()
    address: Optional[str] = Field(None, max_length=500, description="School address")
    po_box: Optional[str] = Field(None, max_length=50, description="School P.O. Box")
    phone: Optional[str] = Field(
        None,
        pattern=r"^\+?[0-9]{10,15}$",
        description="School phone number",
    )
    email: Optional[EmailStr] = Field(None, description="School email address")
    school_type: Literal["day", "boarding", "mixed"] = Field(
        "mixed",
        description="School type (day, boarding, or mixed)",
    )


class SchoolCreate(SchoolBase):
    """Schema for creating a new school."""

    pass


class NotificationSettingsSchema(BaseModel):
    """Per-school SMS/WhatsApp provider and template settings."""

    provider: Optional[str] = Field(None, description="e.g. africas_talking, twilio")
    parent_delivery: Optional[str] = Field(
        "sms",
        description="How to send parent notifications: sms, whatsapp, or both",
    )
    api_key: Optional[str] = Field(None, description="SMS provider API key (Africa's Talking)")
    sender_id: Optional[str] = Field(None, description="SMS sender ID / shortcode")
    username: Optional[str] = Field(None, description="Africa's Talking username")
    whatsapp_phone_number_id: Optional[str] = Field(None, description="WhatsApp Business phone number ID (optional)")
    whatsapp_api_key: Optional[str] = Field(None, description="WhatsApp provider API key if different from SMS")
    sandbox: Optional[bool] = Field(True, description="Use Africa's Talking sandbox (True) or production (False)")
    templates: Optional[dict[str, str]] = Field(
        None,
        description="Keys: student_checkin, student_checkout, teacher_weekly_reminder. Placeholders: {{student_name}}, {{time}}, {{date}}, {{event}}, {{school_name}}, {{present_days}}, {{total_days}}, {{percentage}}, {{teacher_name}}",
    )


class SchoolUpdate(BaseModel):
    """Schema for updating school information (code is immutable)."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    po_box: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,15}$")
    email: Optional[EmailStr] = None
    school_type: Optional[Literal["day", "boarding", "mixed"]] = None
    branding: Optional[dict[str, Any]] = Field(
        None,
        description="Dashboard branding: logoDataUrl, loginBgDataUrl, colors (persisted per school)",
    )
    notification_settings: Optional[dict[str, Any]] = Field(
        None,
        description="SMS/WhatsApp provider, api_key, sender_id, templates (student_checkin, student_checkout, teacher_weekly_reminder)",
    )
    geofence_lat: Optional[float] = Field(None, description="School location latitude for mobile check-in geofence")
    geofence_lng: Optional[float] = Field(None, description="School location longitude for mobile check-in geofence")
    geofence_radius_m: Optional[int] = Field(None, description="Geofence radius in metres (default 150)")


class SchoolResponse(SchoolBase):
    """Schema for school response."""

    id: int
    is_deleted: bool
    created_at: datetime
    updated_at: Optional[datetime]
    branding: Optional[dict[str, Any]] = None
    notification_settings: Optional[dict[str, Any]] = None
    geofence_lat: Optional[float] = None
    geofence_lng: Optional[float] = None
    geofence_radius_m: Optional[int] = None

    class Config:
        from_attributes = True


class AdminUserDetails(BaseModel):
    """Schema for admin user details during school registration."""

    email: EmailStr = Field(..., description="Admin email address")
    first_name: str = Field(..., min_length=1, max_length=100, description="Admin first name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Admin last name")
    password: str = Field(
        ...,
        min_length=4,
        max_length=72,
        description="Admin password (must be between 4 and 72 characters)"
    )


class SchoolRegistrationWithAdmin(SchoolBase):
    """Schema for school registration with admin user creation."""

    admin: AdminUserDetails = Field(..., description="Admin user details for the school")


class SchoolRegistrationResponse(SchoolResponse):
    """Schema for school registration response including admin user info."""

    admin_user: dict = Field(..., description="Created admin user information (without password)")


class SchoolWithUserResponse(SchoolResponse):
    """Schema for school response with current user information."""

    user: dict = Field(..., description="Current authenticated user information (without password)")

