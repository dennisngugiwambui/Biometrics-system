"""Forgot-password flow: issue a one-time reset link by email, then set the new password.

Algorithm
---------
1. ``request_reset(email)``
   * Always answers the same way, whether or not the email has an account, so
     the form cannot be used to discover who is registered.
   * Rate-limited per email address (and per client IP in the route) so the
     form cannot be used to flood someone's inbox.
   * For an active account, builds a signed token (see
     ``security.create_password_reset_token``) that expires after
     ``PASSWORD_RESET_EXPIRE_MINUTES`` and embeds a fingerprint of the current
     password hash, then emails ``APP_BASE_URL/reset-password?token=…``.
2. ``check_token(token)`` — lets the reset page say up front whether the link
   is still good (valid signature, not expired, account active, password not
   changed since the link was issued).
3. ``reset_password(token, new_password)`` — re-checks all of the above,
   validates the new password and stores its hash. Because the hash changes,
   the fingerprint in this and every older link stops matching: one use only.
"""

from __future__ import annotations

import logging
import smtplib
import threading
import time
from collections import defaultdict, deque
from email.message import EmailMessage

from sqlalchemy.ext.asyncio import AsyncSession

from school_service.core.config import settings
from school_service.core.security import (
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    password_fingerprint,
    validate_password_strength,
)
from school_service.models.user import User
from school_service.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

GENERIC_REQUEST_MESSAGE = (
    "If that email belongs to an account, a password reset link is on its way. "
    "Check your inbox (and spam folder)."
)


class ResetLinkInvalid(Exception):
    """The reset link is malformed, expired, or already used."""


# ── tiny in-memory rate limiter ────────────────────────────────────────────

class _SlidingWindowLimiter:
    """Allow at most ``limit`` hits per ``window`` seconds for each key."""

    def __init__(self, limit: int, window: float):
        self.limit = limit
        self.window = window
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True


# 3 reset emails per address per 15 minutes; 10 requests per client IP per 15 minutes.
email_limiter = _SlidingWindowLimiter(limit=3, window=15 * 60)
ip_limiter = _SlidingWindowLimiter(limit=10, window=15 * 60)


# ── email ──────────────────────────────────────────────────────────────────

def _smtp_enabled() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def send_reset_email(to_email: str, first_name: str, link: str) -> None:
    """Send the reset link. Runs in a background task, after the response."""
    minutes = settings.PASSWORD_RESET_EXPIRE_MINUTES
    if not _smtp_enabled():
        if settings.DEBUG:
            logger.warning("SMTP not configured — password reset link for %s: %s", to_email, link)
        else:
            logger.error("SMTP not configured; could not send password reset email to %s", to_email)
        return

    msg = EmailMessage()
    msg["Subject"] = "Reset your School Biometric password"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email
    greeting = f"Hello {first_name}," if first_name else "Hello,"
    msg.set_content(
        f"{greeting}\n\n"
        "We received a request to reset the password for your School Biometric account.\n\n"
        f"Reset your password here (the link works for {minutes} minutes, once):\n{link}\n\n"
        "If you did not ask for this, you can ignore this email — your password stays the same.\n"
    )
    msg.add_alternative(
        f"""\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;color:#0f172a">
  <p>{greeting}</p>
  <p>We received a request to reset the password for your School Biometric account.</p>
  <p style="margin:28px 0">
    <a href="{link}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">
      Reset my password
    </a>
  </p>
  <p style="color:#64748b;font-size:13px">The link works once, for {minutes} minutes.
  If you did not ask for this, ignore this email — your password stays the same.</p>
</div>""",
        subtype="html",
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Password reset email sent to %s", to_email)
    except Exception:  # never surface SMTP problems to the requester
        logger.exception("Failed to send password reset email to %s", to_email)


# ── service ────────────────────────────────────────────────────────────────

class PasswordResetService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)

    async def request_reset(self, email: str) -> tuple[str, str, str] | None:
        """Return (to_email, first_name, link) when an email should be sent, else None."""
        email = email.strip().lower()
        if not email_limiter.allow(email):
            logger.warning("Password reset rate limit hit for %s", email)
            return None
        user = await self.users.get_user_by_email(email)
        if not user or not user.is_active:
            return None
        token = create_password_reset_token(user.id, user.hashed_password)
        link = f"{settings.APP_BASE_URL.rstrip('/')}/reset-password?token={token}"
        return user.email, user.first_name or "", link

    async def _user_for_token(self, token: str) -> User:
        payload = decode_password_reset_token(token or "")
        if payload is None:
            raise ResetLinkInvalid("This reset link is invalid or has expired.")
        try:
            user_id = int(payload["sub"])
        except (TypeError, ValueError):
            raise ResetLinkInvalid("This reset link is invalid or has expired.")
        user = await self.users.get_user_by_id(user_id)
        if not user or not user.is_active:
            raise ResetLinkInvalid("This reset link is invalid or has expired.")
        if payload["fp"] != password_fingerprint(user.hashed_password):
            raise ResetLinkInvalid("This reset link has already been used. Request a new one.")
        return user

    async def check_token(self, token: str) -> str:
        """Return a masked email for a usable link, or raise ResetLinkInvalid."""
        user = await self._user_for_token(token)
        name, _, domain = user.email.partition("@")
        masked = (name[:2] + "•" * max(1, len(name) - 2)) if len(name) > 2 else name[:1] + "•"
        return f"{masked}@{domain}"

    async def reset_password(self, token: str, new_password: str) -> None:
        user = await self._user_for_token(token)
        ok, error = validate_password_strength(new_password.strip())
        if not ok:
            raise ValueError(error)
        user.hashed_password = hash_password(new_password)
        await self.db.commit()
        logger.info("Password reset completed for user id=%s", user.id)
