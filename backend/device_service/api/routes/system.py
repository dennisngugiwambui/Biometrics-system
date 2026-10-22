"""API routes for system-level operations (reset to default)."""

import logging

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from device_service.core.database import get_db
from device_service.api.dependencies import get_current_user
from device_service.services.system_reset_service import SystemResetService
from school_service.services.user_service import UserService
from shared.schemas.user import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/system", tags=["system"])


class SystemResetRequest(BaseModel):
    """Confirmation payload for a destructive system reset."""

    confirm: str = Field(..., description="Must equal 'RESET' to proceed")
    password: str = Field(..., description="Current admin password (re-entered to confirm)")
    scope: Literal["system", "devices", "both"] = Field(
        default="both",
        description="'system' wipes the database, 'devices' clears physical devices, 'both' does both",
    )


@router.post(
    "/reset",
    summary="Reset the system to default",
    description="""
    Wipe all operational data (students, teachers, attendance, enrollments, templates,
    notifications, alumni, support tickets, classes/streams, device groups) for the
    current school and start fresh.

    KEEPS the school, login users (admins), and device records — including device
    IP/port so connections keep working. Optionally clears each physical device too.

    Requires the literal confirmation string `RESET` and the current admin password.
    """,
    responses={
        200: {"description": "System reset completed"},
        400: {"description": "Missing/invalid confirmation"},
        401: {"description": "Password verification failed"},
    },
)
async def reset_system(
    request: SystemResetRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset the current school's system to a clean state (destructive)."""
    if request.confirm.strip() != "RESET":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation failed. Type RESET to confirm.",
        )

    # Re-verify the admin password to guard this destructive action.
    user_service = UserService(db)
    verified = await user_service.authenticate_user(current_user.email, request.password)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password.",
        )

    reset_service = SystemResetService(db)
    try:
        summary = await reset_service.reset_school(
            current_user.school_id, scope=request.scope
        )
    except Exception as e:  # noqa: BLE001
        logger.error("System reset failed for school %s: %s", current_user.school_id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="System reset failed. No partial data was committed.",
        )

    return {"status": "ok", "message": "System reset complete.", **summary}
