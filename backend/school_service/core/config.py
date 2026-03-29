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
