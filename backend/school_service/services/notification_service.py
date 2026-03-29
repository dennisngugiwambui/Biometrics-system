"""Service layer for in-app notification business logic."""

from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Tuple
import math

from school_service.repositories.notification_repository import NotificationRepository
from shared.schemas.notification import (
    NotificationCreate, 
    NotificationResponse, 
    PaginatedNotificationResponse
)


class NotificationService:
    """Service for managing in-app notifications."""

    def __init__(self, db: AsyncSession):
        self.repo = NotificationRepository(db)

    async def create_notification(self, data: NotificationCreate) -> NotificationResponse:
        """Create a new notification."""
        result = await self.repo.create(data)
        return NotificationResponse.model_validate(result)

    async def list_notifications(
        self,
        school_id: int,
        user_id: Optional[int] = None,
        is_read: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20
    ) -> PaginatedNotificationResponse:
        """Get paginated notifications."""
        items, total = await self.repo.list_notifications(
            school_id=school_id,
            user_id=user_id,
            is_read=is_read,
            page=page,
            page_size=page_size
        )
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        
        return PaginatedNotificationResponse(
            items=[NotificationResponse.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    async def get_unread_count(self, school_id: int, user_id: Optional[int] = None) -> int:
        """Get count of unread notifications."""
        return await self.repo.get_unread_count(school_id, user_id)

    async def mark_as_read(self, notification_id: int, school_id: int) -> bool:
        """Mark single notification as read."""
        return await self.repo.mark_as_read(notification_id, school_id)

    async def mark_all_as_read(self, school_id: int, user_id: Optional[int] = None) -> int:
        """Mark all notifications as read."""
        return await self.repo.mark_all_as_read(school_id, user_id)
