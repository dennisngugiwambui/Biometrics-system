"""Platform owner accounts and school licenses (the /management console)."""

from datetime import date

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from shared.database.base import Base


class PlatformAdmin(Base):
    """Owner of the platform — creates schools and issues their licenses. Not tied to a school."""

    __tablename__ = "platform_admins"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False, default="Platform Owner")
    must_change_password = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SchoolLicense(Base):
    """One licence period for a school. The newest active, unexpired one lets its staff sign in."""

    __tablename__ = "school_licenses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    license_key = Column(String(40), unique=True, nullable=False, index=True)
    certificate_no = Column(String(40), unique=True, nullable=False, index=True)
    plan = Column(String(50), nullable=False, default="standard")
    max_students = Column(Integer, nullable=True)
    max_devices = Column(Integer, nullable=True)
    starts_on = Column(Date, nullable=False)
    expires_on = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="active")  # active | suspended | revoked
    notes = Column(Text, nullable=True)
    issued_by = Column(Integer, ForeignKey("platform_admins.id"), nullable=True)
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    credentials_sent_at = Column(DateTime(timezone=True), nullable=True)

    def is_valid_on(self, day: date) -> bool:
        return self.status == "active" and self.starts_on <= day <= self.expires_on
