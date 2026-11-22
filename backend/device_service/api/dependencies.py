"""Dependency injection for Device Service."""

import logging
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from device_service.core.database import get_db
from device_service.core.config import settings
from shared.schemas.user import UserResponse
from school_service.core.security import decode_access_token
from shared.session_revocation import is_revoked

logger = logging.getLogger(__name__)

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Dependency to get current authenticated user from JWT token.
    
    This dependency extracts the user from the JWT token and returns
    a UserResponse object for use in route handlers.
    
    Example:
        @router.get("/protected")
        async def protected_route(current_user: UserResponse = Depends(get_current_user)):
            return {"user": current_user}
    """
    from school_service.services.user_service import UserService
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Decode token
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    # Get user ID from token
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    if await is_revoked(db, payload):
        raise credentials_exception
    
    # Get user from database
    user_service = UserService(db)
    user = await user_service.get_user_by_id(int(user_id))
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return UserResponse.model_validate(user)


async def get_current_user_ws(token: str) -> Optional[UserResponse]:
    """
    Dependency to get current authenticated user from JWT token for WebSocket.
    
    This is used for WebSocket authentication where we can't use Depends().
    Token must be provided as a query parameter.
    
    Args:
        token: JWT token string
    
    Returns:
        UserResponse if authenticated, None otherwise
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from device_service.core.database import AsyncSessionLocal
    from school_service.services.user_service import UserService
    
    # Create a new database session for this request
    async with AsyncSessionLocal() as db:
        try:
            # Decode token
            payload = decode_access_token(token)
            if payload is None:
                return None
            
            # Get user ID from token
            user_id: str | None = payload.get("sub")
            if user_id is None:
                return None
            if await is_revoked(db, payload):
                return None
            
            # Get user from database
            user_service = UserService(db)
            user = await user_service.get_user_by_id(int(user_id))
            
            if user is None:
                return None
            
            if not user.is_active:
                return None
            
            return UserResponse.model_validate(user)
        except Exception as e:
            logger.error(f"WebSocket auth error: {e}", exc_info=True)
            return None
