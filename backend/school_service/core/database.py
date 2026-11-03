"""Database connection and session management."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from school_service.core.config import settings
from shared.database.connect import schema_connect_args

# Import all models to ensure they're registered with SQLAlchemy
# This is necessary for relationships to work across services
from school_service.models import School, User, Student, AcademicClass, Stream  # noqa: F401
from device_service.models.device import Device  # noqa: F401
from device_service.models.device_group import DeviceGroup  # noqa: F401

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

