"""Pydantic schemas for User."""

from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    """Base schema for User with common fields."""

    email: EmailStr = Field(..., description="User email address")
    first_name: str = Field(..., min_length=1, max_length=100, description="User first name")
    last_name: str = Field(..., min_length=1, max_length=100, description="User last name")
    role: str = Field(default="school_admin", max_length=50, description="User role")


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: str = Field(
        ...,
        min_length=4,
        max_length=72,
        description="User password (must be between 4 and 72 characters)"
    )
    school_id: int = Field(..., description="ID of the school this user belongs to")

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        """Validate password length only."""
        if len(v) < 4:
            raise ValueError("Password must be at least 4 characters long")
        
        if len(v) > 72:
            raise ValueError("Password cannot be longer than 72 characters")
        
        return v


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class UserResponse(UserBase):
    """Schema for user response (excludes password)."""

    id: int
    school_id: int
    is_active: bool
    is_deleted: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Schema for authentication token response."""

    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for decoded token data."""

    user_id: Optional[int] = None
    email: Optional[str] = None
    school_id: Optional[int] = None

