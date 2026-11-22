"""Sign in to attendance with a Shulepoa portal account.

A school that is already on portal.shulepoa.co.ke should not need a second set of
passwords. When the email and password typed at sign-in are not an attendance
account, the portal is asked whether they are one of its own. If they are, the
school and its administrator are created here on the first sign-in (or the
existing account for that email is used) and the person is signed in as usual.

The portal only checks the password: it starts no session over there, and the
attendance account keeps a random password nobody knows, so the portal stays the
one place the password lives. The licence rules do not change; a school still
needs a current licence to get in (see services/licensing).
"""

import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.core.config import settings
from school_service.core.security import hash_password
from school_service.models import School, User

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 15


class PortalRefusal(Exception):
    """The portal recognised the person but will not let them in; the message is for them."""

    def __init__(self, message: str, status_code: int = 403):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def enabled() -> bool:
    return bool((settings.PORTAL_API_URL or "").strip())


def _caller_headers() -> dict:
    """How this server proves itself to the portal: the shared key, else a short token signed with SECRET_KEY."""
    key = settings.PLATFORM_SERVICE_KEY or ""
    if len(key) >= 32:
        return {"X-Platform-Service-Key": key}
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"typ": "attendance-link", "iat": now, "exp": now + timedelta(minutes=2)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


async def verify_with_portal(email: str, password: str) -> Optional[dict]:
    """The portal's answer {user, school} when the credentials are right, None when they are not.

    Raises PortalRefusal when the account is real but may not use attendance (wrong role,
    two-step sign-in, paused, school switched off). A portal that cannot be reached counts
    as "not a portal account": sign-in simply fails as it would have before.
    """
    if not enabled():
        return None
    url = settings.PORTAL_API_URL.rstrip("/") + "/api/attendance-link/verify"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            res = await client.post(url, json={"email": email, "password": password}, headers=_caller_headers())
    except httpx.HTTPError as exc:
        logger.warning("Portal sign-in check could not reach %s: %s", url, exc.__class__.__name__)
        return None

    try:
        body = res.json()
    except ValueError:
        body = {}
    if res.status_code == 200 and body.get("success"):
        return body.get("data")
    code = body.get("code")
    if code in ("role", "two_factor", "school", "locked"):
        raise PortalRefusal(body.get("message") or "The portal did not allow this sign-in.", res.status_code)
    if res.status_code >= 500 or code == "caller":
        logger.warning("Portal sign-in check answered %s (%s)", res.status_code, code)
    return None


def _school_code(portal_school: dict) -> str:
    raw = portal_school.get("code") or portal_school.get("abbreviation") or portal_school.get("name") or "SCHOOL"
    code = re.sub(r"[^A-Z0-9-]", "", str(raw).upper())[:12]
    return code if len(code) >= 3 else (code + "SCH")[:12]


async def user_for_portal_account(db: AsyncSession, portal: dict) -> User:
    """The attendance account for this portal person, created with their school the first time."""
    person, portal_school = portal["user"], portal["school"]
    email = str(person["email"]).strip().lower()

    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        if existing.is_deleted or not existing.is_active:
            raise PortalRefusal("This account is switched off. Contact Shulepoa.")
        return existing

    base = _school_code(portal_school)
    code, n = base, 2
    while (await db.execute(select(School).where(School.code == code))).scalar_one_or_none():
        code, n = f"{base}{n}", n + 1

    school = School(
        name=str(portal_school.get("name") or "School").strip()[:200],
        code=code,
        email=(portal_school.get("email") or None),
        phone=_phone(portal_school.get("phone")),
        address=portal_school.get("address") or None,
        po_box=(portal_school.get("po_box") or None),
        school_type="mixed",
    )
    db.add(school)
    await db.flush()
    user = User(
        school_id=school.id,
        email=email,
        # A password nobody knows: the portal is where this person's password lives.
        hashed_password=hash_password(secrets.token_urlsafe(32) + "Aa1!"),
        first_name=str(person.get("first_name") or "Admin").strip()[:100] or "Admin",
        last_name=str(person.get("last_name") or "-").strip()[:100] or "-",
        role="school_admin",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Created attendance school %s (%s) for portal account %s", school.name, school.code, email)
    return user


def _phone(raw) -> Optional[str]:
    if not raw:
        return None
    cleaned = re.sub(r"[\s().-]", "", str(raw))
    return cleaned if re.fullmatch(r"\+?[0-9]{10,15}", cleaned) else None
