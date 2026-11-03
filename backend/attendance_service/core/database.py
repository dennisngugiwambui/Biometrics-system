"""Database connection and session management for Attendance Service."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from attendance_service.core.config import settings
from shared.database.connect import schema_connect_args

# Import all models to ensure SQLAlchemy can resolve relationships
from school_service.models.school import School  # noqa: F401
from school_service.models.user import User  # noqa: F401
from school_service.models.student import Student  # noqa: F401
from school_service.models.academic_class import AcademicClass  # noqa: F401
from school_service.models.stream import Stream  # noqa: F401
from device_service.models.device import Device  # noqa: F401
from attendance_service.models.attendance_record import AttendanceRecord  # noqa: F401

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=schema_connect_args(settings.DB_SCHEMA),
    echo=settings.DEBUG,
    future=True,
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
