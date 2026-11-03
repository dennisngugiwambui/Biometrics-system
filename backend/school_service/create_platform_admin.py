"""Create (or reset) the platform owner account for the /management console.

    cd backend/school_service
    python create_platform_admin.py attedance@shulepoa.co.ke [--name "Shulepoa"] [--out FIRST-LOGIN.txt]

Writes a temporary password to --out (mode 600), never to the terminal. The
owner must choose their own password at first sign-in.
"""

import argparse
import asyncio
import os
import secrets
import string
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from school_service.core.database import AsyncSessionLocal  # noqa: E402
from school_service.core.security import hash_password  # noqa: E402
from school_service.models.platform import PlatformAdmin  # noqa: E402


def temp_password() -> str:
    alphabet = "".join(c for c in string.ascii_letters + string.digits if c not in "0O1lI")
    return "Shule-" + "".join(secrets.choice(alphabet) for _ in range(12))


async def main(email: str, name: str, out: Path) -> None:
    password = temp_password()
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(select(PlatformAdmin).where(PlatformAdmin.email == email))).scalar_one_or_none()
        action = "reset" if admin else "created"
        if not admin:
            admin = PlatformAdmin(email=email, full_name=name)
            db.add(admin)
        admin.hashed_password = hash_password(password)
        admin.must_change_password = True
        admin.is_active = True
        await db.commit()
    out.write_text(
        "Shulepoa Attendance — platform owner first sign-in\n\n"
        f"Email:     {email}\nTemporary: {password}\n\n"
        "You will be asked to choose your own password straight away. Delete this file afterwards.\n",
        encoding="utf-8",
    )
    os.chmod(out, 0o600)
    print(f"Platform owner {email} {action}; temporary password written to {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("email")
    ap.add_argument("--name", default="Shulepoa")
    ap.add_argument("--out", default="FIRST-LOGIN.txt")
    a = ap.parse_args()
    asyncio.run(main(a.email.strip().lower(), a.name, Path(a.out).resolve()))
