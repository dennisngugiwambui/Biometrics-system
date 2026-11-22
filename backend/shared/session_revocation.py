"""Signing out on one device signs the account out everywhere.

Tokens are stateless, so "signed out" has to be remembered somewhere. Each user has at
most one row here: the moment they last signed out. Any access or refresh token issued
before that moment is dead, on every device and in every service. A token issued after
it (a fresh sign-in) works as normal.

The table is created on first use, so no separate migration has to run first.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_table_ready = False


async def _ensure_table(db: AsyncSession) -> None:
    global _table_ready
    if _table_ready:
        return
    await db.execute(text(
        "CREATE TABLE IF NOT EXISTS session_revocations ("
        "user_id INTEGER PRIMARY KEY, revoked_at TIMESTAMPTZ NOT NULL)"
    ))
    await db.commit()
    _table_ready = True


async def revoke_all_sessions(db: AsyncSession, user_id: int) -> None:
    """Every token issued to this user up to now stops working."""
    await _ensure_table(db)
    await db.execute(
        text(
            "INSERT INTO session_revocations (user_id, revoked_at) VALUES (:u, now()) "
            "ON CONFLICT (user_id) DO UPDATE SET revoked_at = EXCLUDED.revoked_at"
        ),
        {"u": int(user_id)},
    )
    await db.commit()


async def sessions_revoked_at(db: AsyncSession, user_id: int) -> Optional[datetime]:
    await _ensure_table(db)
    row = (await db.execute(
        text("SELECT revoked_at FROM session_revocations WHERE user_id = :u"), {"u": int(user_id)}
    )).first()
    return row[0] if row else None


def token_predates(payload: dict, revoked_at: Optional[datetime]) -> bool:
    """True when the token was issued before the user last signed out.

    Tokens carry whole seconds, so a token from the same second as the sign-out is kept:
    that is a sign-in made right after signing out, which must work.
    """
    if revoked_at is None:
        return False
    iat = payload.get("iat")
    if iat is None:
        return True  # no issue time: cannot be shown to be newer than the sign-out
    if revoked_at.tzinfo is None:
        revoked_at = revoked_at.replace(tzinfo=timezone.utc)
    return int(iat) < int(revoked_at.timestamp())


async def is_revoked(db: AsyncSession, payload: dict) -> bool:
    user_id = payload.get("sub")
    if payload.get("role") == "teacher" or user_id is None or not str(user_id).isdigit():
        return False  # not an admin user's token (e.g. a teacher's phone token)
    return token_predates(payload, await sessions_revoked_at(db, int(user_id)))
