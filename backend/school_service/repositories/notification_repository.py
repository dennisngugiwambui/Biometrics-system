"""Repository for in-app notification data access."""

from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Tuple
from datetime import datetime

from school_service.models.notification import Notification
from shared.schemas.notification import NotificationCreate


class NotificationRepository:
    """Repository for Notification database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: NotificationCreate) -> Notification:
        """Create a new notification."""
        notification = Notification(
            school_id=data.school_id,
            user_id=data.user_id,
            title=data.title,
            message=data.message,
            type=data.type,
            link=data.link
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        return notification

    async def list_notifications(
        self,
        school_id: int,
        user_id: Optional[int] = None,
        is_read: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Notification], int]:
        """List notifications for a school or specific user."""
        query = select(Notification).where(Notification.school_id == school_id)
        
        if user_id is not None:
            # Show either user-specific or school-wide (null user_id)
            from sqlalchemy import or_
            query = query.where(or_(Notification.user_id == user_id, Notification.user_id == None))
        
        if is_read is not None:
            query = query.where(Notification.is_read == is_read)
            
        query = query.order_by(desc(Notification.created_at))
        
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar_one()
        
        # Pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def get_unread_count(self, school_id: int, user_id: Optional[int] = None) -> int:
        """Get count of unread notifications."""
        query = select(func.count(Notification.id)).where(
            Notification.school_id == school_id,
            Notification.is_read == False
        )
        if user_id is not None:
            from sqlalchemy import or_
            query = query.where(or_(Notification.user_id == user_id, Notification.user_id == None))
            
        result = await self.db.execute(query)
        return result.scalar_one()

    async def mark_as_read(self, notification_id: int, school_id: int) -> bool:
        """Mark a single notification as read."""
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id, Notification.school_id == school_id)
            .values(is_read=True)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0

    async def mark_all_as_read(self, school_id: int, user_id: Optional[int] = None) -> int:
        """Mark all notifications for a user/school as read."""
        stmt = (
            update(Notification)
            .where(Notification.school_id == school_id, Notification.is_read == False)
            .values(is_read=True)
        )
        if user_id is not None:
            from sqlalchemy import or_
            stmt = stmt.where(or_(Notification.user_id == user_id, Notification.user_id == None))
            
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount
