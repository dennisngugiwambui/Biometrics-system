"""Whether a school may sign in: it needs a current licence from the /management console."""

from datetime import date
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.models.platform import SchoolLicense


async def license_block_reason(db: AsyncSession, school_id: int) -> Optional[str]:
    """None when the school holds a current licence, otherwise the message to show at sign-in."""
    lics = (await db.execute(select(SchoolLicense).where(SchoolLicense.school_id == school_id))).scalars().all()
    today = date.today()
    if any(l.is_valid_on(today) for l in lics):
        return None
    if not lics:
        return "Your school is not licensed yet. Contact Shulepoa to activate your account."
    if any(l.status == "suspended" for l in lics):
        return "Your school's licence is suspended. Contact Shulepoa."
    return "Your school's licence has expired. Contact Shulepoa to renew it."


async def require_license(db: AsyncSession, school_id: int) -> None:
    reason = await license_block_reason(db, school_id)
    if reason:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)
