"""API routes for in-app Notifications."""

from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from school_service.core.database import get_db
from school_service.api.routes.auth import get_current_user
from school_service.services.notification_service import NotificationService
from shared.schemas.user import UserResponse
from shared.schemas.notification import (
    NotificationResponse,
    PaginatedNotificationResponse,
    UnreadCountResponse,
    NotificationUpdate
)

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=PaginatedNotificationResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_read: Optional[bool] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List notifications for the current user and school."""
    svc = NotificationService(db)
    return await svc.list_notifications(
        school_id=current_user.school_id,
        user_id=current_user.id,
        is_read=is_read,
        page=page,
        page_size=page_size
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the count of unread notifications."""
    svc = NotificationService(db)
    count = await svc.get_unread_count(current_user.school_id, current_user.id)
    return UnreadCountResponse(count=count)


@router.put("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_as_read(
    notification_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a notification as read."""
    svc = NotificationService(db)
    success = await svc.mark_as_read(notification_id, current_user.school_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return None


@router.post("/mark-all-read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications for current user as read."""
    svc = NotificationService(db)
    await svc.mark_all_as_read(current_user.school_id, current_user.id)
    return None
