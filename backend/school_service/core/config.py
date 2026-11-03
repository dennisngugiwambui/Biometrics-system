"""Configuration management for School Service.

Defaults are for local development. When hosting, set env vars per deployment (e.g. DATABASE_URL, ALLOWED_ORIGINS, INTERNAL_API_KEY).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Service
    APP_NAME: str = "School Biometric System - School Service"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/school_biometric"
    # Optional schema inside DATABASE_URL (when sharing a database with another app)
    DB_SCHEMA: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/1"

    # Outbound (School → Gateway → Device) for cohort promotion device cleanup
    API_GATEWAY_URL: str = "http://localhost:8000"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    INTERNAL_API_KEY: str = ""  # Optional: when set, allows internal API (school/student by id) via X-Internal-Key
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # Refresh token is long-lived to support auto-refresh / sliding sessions
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Public address of the website — put in the credentials email (sign-in link)
    APP_BASE_URL: str = "http://localhost:3000"

    # Outgoing mail for the /management console (school admin credentials, certificates).
    # Same names as the gateway's, so one .env serves both. Port 465 = SSL, otherwise STARTTLS.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Shulepoa Attendance"

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
        extra="ignore",
    )


settings = Settings()
