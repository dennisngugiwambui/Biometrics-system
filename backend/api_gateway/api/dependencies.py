"""Dependency injection for API Gateway."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from shared.schemas.user import UserResponse
from api_gateway.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> UserResponse:
    """
    Dependency to get current authenticated user from JWT token.

    This decodes the JWT token and extracts user information.
    The token is validated and user information is returned.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        if payload.get("typ") not in (None, "access"):
            raise credentials_exception

        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        from datetime import datetime

        iat = payload.get("iat")
        created_at = datetime.utcfromtimestamp(iat) if iat else datetime.utcnow()

        return UserResponse(
            id=int(user_id),
            email=payload.get("email", ""),
            first_name=payload.get("first_name", ""),
            last_name=payload.get("last_name", ""),
            role=payload.get("role", "school_admin"),
            school_id=payload.get("school_id", 0),
            is_active=True,
            is_deleted=False,
            created_at=created_at,
            updated_at=None,
        )
    except JWTError:
        raise credentials_exception


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a DB session for direct (non-proxy) gateway routes like support tickets."""
    from school_service.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
