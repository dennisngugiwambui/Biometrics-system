"""Dependency injection for Attendance Service."""

import logging
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from attendance_service.core.database import get_db
from shared.schemas.user import UserResponse
from school_service.core.security import decode_access_token

logger = logging.getLogger(__name__)

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Dependency to get current authenticated user (admin)."""
    from school_service.services.user_service import UserService

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user_service = UserService(db)
    user = await user_service.get_user_by_id(int(user_id))

    if user is None:
        # Check if it's a teacher instead
        if payload.get("role") == "teacher":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin login required for this endpoint.",
            )
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    return UserResponse.model_validate(user)


@dataclass
class TeacherAuth:
    id: int
    school_id: int
    name: str


async def get_current_teacher(
    token: str = Depends(oauth2_scheme),
) -> TeacherAuth:
    """Dependency for mobile teacher auth (trusts token payload)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid teacher credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None or payload.get("role") != "teacher":
        raise credentials_exception

    teacher_id = payload.get("sub")
    school_id = payload.get("school_id")
    name = payload.get("name")
    
    if teacher_id is None or school_id is None:
        raise credentials_exception
        
    return TeacherAuth(id=int(teacher_id), school_id=int(school_id), name=name or "Teacher")
