"""Repository for User database operations."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from school_service.models.user import User


class UserRepository:
    """Repository for User model database operations."""

    def __init__(self, db: AsyncSession):
        """
        Initialize UserRepository.

        Args:
            db: Async database session
        """
        self.db = db

    async def create_user(self, user_data: dict) -> User:
        """
        Create a new user.

        Args:
            user_data: Dictionary containing user data (email, hashed_password, etc.)

        Returns:
            Created User instance
        """
        user = User(**user_data)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def create_user_without_commit(self, user_data: dict) -> User:
        """
        Create a new user without committing.
        
        Useful for transactions where you want to commit multiple operations together.
        Caller is responsible for committing the transaction.
        
        Args:
            user_data: Dictionary containing user data (email, hashed_password, etc.)

        Returns:
            Created User instance (not yet committed)
        """
        user = User(**user_data)
        self.db.add(user)
        # Flush to get the ID without committing
        await self.db.flush()
        return user

    async def get_user_by_id(self, user_id: int) -> User | None:
        """
        Get user by ID.

        Args:
            user_id: User ID

        Returns:
            User instance or None if not found
        """
        result = await self.db.execute(
            select(User)
            .where(User.id == user_id)
            .where(User.is_deleted == False)
            .options(selectinload(User.school))
        )
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> User | None:
        """
        Get user by email address.

        Args:
            email: User email address

        Returns:
            User instance or None if not found
        """
        result = await self.db.execute(
            select(User)
            .where(User.email == email.lower())
            .where(User.is_deleted == False)
            .options(selectinload(User.school))
        )
        return result.scalar_one_or_none()

    async def get_user_by_email_and_school(
        self, email: str, school_id: int
    ) -> User | None:
        """
        Get user by email and school ID.

        Args:
            email: User email address
            school_id: School ID

        Returns:
            User instance or None if not found
        """
        result = await self.db.execute(
            select(User)
            .where(User.email == email.lower())
            .where(User.school_id == school_id)
            .where(User.is_deleted == False)
            .options(selectinload(User.school))
        )
        return result.scalar_one_or_none()

    async def list_users_by_school(self, school_id: int) -> list[User]:
        """
        List all active (non-deleted) users for a school, newest first.

        Args:
            school_id: School ID

        Returns:
            List of User instances
        """
        result = await self.db.execute(
            select(User)
            .where(User.school_id == school_id)
            .where(User.is_deleted == False)
            .order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def check_email_exists(self, email: str, exclude_user_id: int | None = None) -> bool:
        """
        Check if email already exists.

        Args:
            email: Email address to check
            exclude_user_id: Optional user ID to exclude from check (for updates)

        Returns:
            True if email exists, False otherwise
        """
        query = select(User).where(User.email == email.lower()).where(User.is_deleted == False)
        
        if exclude_user_id:
            query = query.where(User.id != exclude_user_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

