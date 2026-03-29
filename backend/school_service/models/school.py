"""School database model."""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from shared.database.base import Base


class School(Base):
    """School model representing a registered school in the system."""

    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    address = Column(Text, nullable=True)
    po_box = Column(String(50), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    school_type = Column(String(20), nullable=False, default="mixed", index=True)
    # SMS/WhatsApp: provider, api_key, sender_id, templates (student_checkin, student_checkout, teacher_weekly_reminder)
    notification_settings = Column(JSONB, nullable=True)
    # Dashboard branding: { "logoDataUrl", "loginBgDataUrl", "colors": [] } — persisted per school so same on any device/IP
    branding = Column(JSONB, nullable=True)

    # School premises geofencing (for mobile app check-in/out)
    geofence_lat = Column(Float, nullable=True)
    geofence_lng = Column(Float, nullable=True)
    geofence_radius_m = Column(Integer, nullable=True, default=150)

    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)

    # Relationships
    users = relationship("User", back_populates="school", lazy="selectin")
    classes = relationship("AcademicClass", back_populates="school", lazy="selectin")
    students = relationship("Student", back_populates="school", lazy="selectin")
    devices = relationship("Device", back_populates="school", lazy="selectin")
    device_groups = relationship("DeviceGroup", back_populates="school", lazy="selectin")

    def __repr__(self) -> str:
        return f"<School(id={self.id}, name='{self.name}', code='{self.code}')>"

