"""Pydantic schemas for Notifications."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class NotificationBase(BaseModel):
    """Base schema for Notification."""

    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    type: str = Field("system", description="Notification type: system, attendance, enrollment")
    link: Optional[str] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a notification."""

    school_id: int
    user_id: Optional[int] = None


class NotificationUpdate(BaseModel):
    """Schema for updating notification status."""

    is_read: bool


class NotificationResponse(NotificationBase):
    """Schema for notification response."""

    id: int
    school_id: int
    user_id: Optional[int] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    """Schema for unread notification count."""

    count: int


class PaginatedNotificationResponse(BaseModel):
    """Paginated response for notifications."""

    items: List[NotificationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True
