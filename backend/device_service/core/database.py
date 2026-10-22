"""Database connection and session management."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from device_service.core.config import settings

# Import all models to ensure SQLAlchemy can resolve relationships
# This is critical for the health check service which creates sessions independently
from school_service.models.school import School
from school_service.models.user import User
from school_service.models.student import Student
from device_service.models.device import Device
from device_service.models.device_group import DeviceGroup
from device_service.models.enrollment import EnrollmentSession
from device_service.models.fingerprint_template import FingerprintTemplate
from attendance_service.models.attendance_record import AttendanceRecord  # noqa: F401

# Create async engine
# The background loops (health check, info sync, attendance poll) each hold a
# session per device they contact, so the pool has to cover those plus request
# handlers. pool_pre_ping discards connections that were broken by an earlier
# error instead of handing them out again.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency for getting database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

