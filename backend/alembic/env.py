"""Alembic environment configuration."""

from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import sys
from pathlib import Path

# Add backend directory to Python path to allow imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Import your models here when they're created
from shared.database.base import Base
from school_service.models.school import School  # noqa: F401
from school_service.models.user import User  # noqa: F401
from school_service.models.student import Student  # noqa: F401
from school_service.models.academic_class import AcademicClass  # noqa: F401
from school_service.models.teacher import Teacher  # noqa: F401
from school_service.models.notification import Notification  # noqa: F401
from school_service.models.alumni_record import AlumniRecord  # noqa: F401
from device_service.models.device import Device  # noqa: F401
from device_service.models.device_group import DeviceGroup  # noqa: F401
from device_service.models.enrollment import EnrollmentSession  # noqa: F401
from device_service.models.fingerprint_template import FingerprintTemplate  # noqa: F401
from attendance_service.models.attendance_record import AttendanceRecord  # noqa: F401

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the SQLAlchemy URL from environment or config
import os
from dotenv import load_dotenv

load_dotenv()
database_url = os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
config.set_main_option("sqlalchemy.url", database_url)

# Import all models to ensure they're registered with Base
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = database_url
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio

    asyncio.run(run_migrations_online())

