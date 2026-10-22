"""Service for User business logic."""

from sqlalchemy.ext.asyncio import AsyncSession

from school_service.repositories.user_repository import UserRepository
from school_service.core.security import hash_password, verify_password, validate_password_strength
from school_service.models.user import User
from shared.schemas.user import UserCreate


class UserService:
    """Service for User business logic."""

    def __init__(self, db: AsyncSession):
        """
        Initialize UserService.

        Args:
            db: Async database session
        """
        self.db = db
        self.user_repo = UserRepository(db)

    async def create_user(self, user_data: UserCreate) -> User:
        """
        Create a new user with password hashing.

        Args:
            user_data: UserCreate schema with user data

        Returns:
            Created User instance

        Raises:
            ValueError: If email already exists or validation fails
        """
        # Check if email already exists
        if await self.user_repo.check_email_exists(user_data.email):
            raise ValueError(f"Email '{user_data.email}' is already registered")

        # Validate password strength (schema also validates, but double-check)
        is_valid, error_msg = validate_password_strength(user_data.password)
        if not is_valid:
            raise ValueError(error_msg)

        # Hash password
        hashed_password = hash_password(user_data.password)

        # Create user data dict
        user_dict = {
            "email": user_data.email.lower(),  # Normalize email to lowercase
            "hashed_password": hashed_password,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "role": user_data.role,
            "school_id": user_data.school_id,
            "is_active": True,
            "is_deleted": False,
        }

        # Create user
        user = await self.user_repo.create_user(user_dict)
        return user

    async def create_user_without_commit(self, user_data: UserCreate) -> User:
        """
        Create a new user with password hashing, without committing.
        
        Useful for transactions where you want to commit multiple operations together.
        Caller is responsible for committing the transaction.
        
        Args:
            user_data: UserCreate schema with user data

        Returns:
            Created User instance (not yet committed)

        Raises:
            ValueError: If email already exists or validation fails
        """
        # Check if email already exists
        if await self.user_repo.check_email_exists(user_data.email):
            raise ValueError(f"Admin: Email '{user_data.email}' is already registered")

        # Validate password strength (schema also validates, but double-check)
        is_valid, error_msg = validate_password_strength(user_data.password)
        if not is_valid:
            raise ValueError(f"Admin: {error_msg}")

        # Hash password
        hashed_password = hash_password(user_data.password)

        # Create user data dict
        user_dict = {
            "email": user_data.email.lower(),  # Normalize email to lowercase
            "hashed_password": hashed_password,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "role": user_data.role,
            "school_id": user_data.school_id,
            "is_active": True,
            "is_deleted": False,
        }

        # Create user without committing
        user = await self.user_repo.create_user_without_commit(user_dict)
        return user

    async def authenticate_user(self, email: str, password: str) -> User | None:
        """
        Authenticate a user by email and password.

        Args:
            email: User email address
            password: Plain text password

        Returns:
            User instance if authentication successful, None otherwise
        """
        # Get user by email
        user = await self.user_repo.get_user_by_email(email.lower())
        
        if not user:
            return None
        
        # Check if user is active
        if not user.is_active:
            return None
        
        # Verify password
        if not verify_password(password, user.hashed_password):
            return None
        
        return user

    async def get_user_by_id(self, user_id: int) -> User | None:
        """
        Get user by ID.

        Args:
            user_id: User ID

        Returns:
            User instance or None if not found
        """
        return await self.user_repo.get_user_by_id(user_id)

    async def list_users_by_school(self, school_id: int) -> list[User]:
        """
        List all active users for a school.

        Args:
            school_id: School ID

        Returns:
            List of User instances
        """
        return await self.user_repo.list_users_by_school(school_id)

    async def get_user_by_email(self, email: str) -> User | None:
        """
        Get user by email.

        Args:
            email: User email address

        Returns:
            User instance or None if not found
        """
        return await self.user_repo.get_user_by_email(email.lower())

