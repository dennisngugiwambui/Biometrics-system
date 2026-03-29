"""Configuration management for Device Service.

Defaults are for local development. When hosting, set env vars per deployment (e.g. DATABASE_URL, API_GATEWAY_URL, NOTIFICATION_INTERNAL_KEY).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Service
    APP_NAME: str = "School Biometric System - Device Service"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/school_biometric"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/2"

    # Device Settings
    SIMULATION_MODE: bool = False  # Toggle for demo vs production
    SIMULATION_DELAY_MIN: float = 1.0  # Min delay in seconds
    SIMULATION_DELAY_MAX: float = 3.0  # Max delay in seconds
    DEFAULT_DEVICE_TIMEOUT: int = 5  # Connection timeout in seconds
    DEVICE_HEALTH_CHECK_INTERVAL: int = 5  # Health check interval in seconds

    # ZKTeco Device Connection Settings
    DEVICE_DEFAULT_PORT: int = 4370  # Default ZKTeco device port
    DEVICE_CONNECTION_RETRY_ATTEMPTS: int = 3  # Number of connection retry attempts
    DEVICE_CONNECTION_RETRY_DELAY: float = 1.0  # Delay between retry attempts (seconds)
    DEVICE_CONNECTION_POOL_SIZE: int = 10  # Maximum number of concurrent device connections
    DEVICE_OMIT_PING: bool = False  # Whether to omit ping during connection

    # Attendance polling
    ATTENDANCE_POLL_INTERVAL: int = 1  # Poll interval in seconds
    ATTENDANCE_POLL_CONCURRENCY: int = 5  # Max devices polled concurrently

    # Attendance entry/exit logic
    # Only suppress accidental double-scans within this window (seconds). After this,
    # alternating IN → OUT → IN works (e.g. checkout 2–5 minutes after check-in).
    ATTENDANCE_ANTI_BOUNCE_SECONDS: int = 90
    ATTENDANCE_TIMEZONE: str = "Africa/Nairobi"  # Timezone for "same day" boundary

    # API Gateway (for triggering parent notifications after attendance save)
    API_GATEWAY_URL: str = "http://localhost:8000"
    NOTIFICATION_INTERNAL_KEY: str = ""  # Must match gateway NOTIFICATION_INTERNAL_KEY and school INTERNAL_API_KEY

    # Security (shared with school_service)
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # Template encryption (Fernet key - base64-encoded 32-byte key)
    TEMPLATE_ENCRYPTION_KEY: str = "5Il3rA9ofAwYk8Ca5o2FCHL3Gas8I9VBnYr3SX0vAIk="

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",  # API Gateway
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        """Handle comma-separated string from .env file."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        env_ignore_empty=True,
        extra="ignore",
    )


settings = Settings()
