"""Create a demo school and an admin login for local testing.

Safe to run more than once: it reuses the school and, if the admin already
exists, resets its password to the one given.

    cd backend
    python scripts/create_demo_admin.py                     # defaults below
    python scripts/create_demo_admin.py --email you@school.ac.ke --password "S3cret!"

Uses DATABASE_URL from backend/.env (default: local Postgres from docker-compose).
Run `alembic upgrade head` first so the tables exist.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from school_service.core.database import AsyncSessionLocal  # noqa: E402
from school_service.core.security import hash_password  # noqa: E402
from school_service.models.school import School  # noqa: E402
from school_service.models.user import User  # noqa: E402

DEFAULTS = {
    "school_name": "Demo School",
    "school_code": "DEMO",
    "email": "admin@demoschool.ac.ke",
    "password": "Admin@1234",
    "first_name": "Demo",
    "last_name": "Admin",
}


async def main(a: argparse.Namespace) -> None:
    email = a.email.strip().lower()
    async with AsyncSessionLocal() as db:
        school = (await db.execute(select(School).where(School.code == a.school_code))).scalar_one_or_none()
        if school is None:
            school = School(name=a.school_name, code=a.school_code, school_type="mixed", email=email)
            db.add(school)
            await db.flush()
            print(f"Created school   : {school.name} (code {school.code}, id {school.id})")
        else:
            print(f"Using school     : {school.name} (code {school.code}, id {school.id})")

        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None:
            user = User(
                school_id=school.id, email=email, hashed_password=hash_password(a.password),
                first_name=a.first_name, last_name=a.last_name, role="school_admin",
                is_active=True, is_deleted=False,
            )
            db.add(user)
            print(f"Created admin    : {email}")
        else:
            user.hashed_password = hash_password(a.password)
            user.is_active, user.is_deleted = True, False
            print(f"Admin existed    : {email} (password reset, account re-activated)")
        await db.commit()

    print("\nSign in with")
    print(f"  Email    : {email}")
    print(f"  Password : {a.password}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for k, v in DEFAULTS.items():
        p.add_argument("--" + k.replace("_", "-"), dest=k, default=v)
    asyncio.run(main(p.parse_args()))
