"""Configuration management for API Gateway.

All URLs and origins use environment variables. Defaults below are for local development only.
When hosting (e.g. School A on their server, School B on another), set env vars per deployment
so each school's instance points to its own services — no code changes required.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Service
    APP_NAME: str = "School Biometric System - API Gateway"
    DEBUG: bool = False

    # Security (must match school_service SECRET_KEY for JWT validation)
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"

    # Backend Service URLs — override in production (e.g. http://school-service:8001 or full URLs)
    SCHOOL_SERVICE_URL: str = "http://localhost:8001"
    DEVICE_SERVICE_URL: str = "http://localhost:8002"
    ATTENDANCE_SERVICE_URL: str = "http://localhost:8003"
    NOTIFICATION_SERVICE_URL: str = "http://localhost:8004"

    # Internal key for service-to-service calls (e.g. device service → trigger parent notifications).
    # Set to same value as school_service INTERNAL_API_KEY.
    NOTIFICATION_INTERNAL_KEY: str = ""

    # Public App URL (used in emails / deep links) — set to frontend URL when hosted (e.g. https://app.school-a.com)
    APP_BASE_URL: str = "http://localhost:3000"

    # Support Contact (displayed in UI + used for notifications)
    SUPPORT_EMAIL: str = "dellyit001@gmail.com"
    SUPPORT_PHONE: str = "+254758024400"

    # SMTP (for support ticket emails)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    # CORS — in production set ALLOWED_ORIGINS to your frontend origin(s), e.g. https://app.school-a.com
    # Comma-separated in .env: ALLOWED_ORIGINS=https://app.school-a.com,https://www.school-a.com
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.175:3000",
        "http://localhost:8000",
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

