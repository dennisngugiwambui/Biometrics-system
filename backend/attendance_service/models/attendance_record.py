"""Attendance record database model."""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from shared.database.base import Base


class EventType:
    """Constants for attendance event types."""

    IN = "IN"
    OUT = "OUT"
    UNKNOWN = "UNKNOWN"


class AttendanceRecord(Base):
    """
    Model for attendance records captured from biometric devices.

    Each record represents a single tap/check-in event from a device.
    student_id is nullable when the device user cannot be matched to a student yet.
    event_type indicates whether this tap is an entry (IN), exit (OUT), or undetermined (UNKNOWN).
    """

    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True, index=True) # Nullable for mobile_app
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    # Captured at ingest time so reports stay accurate after cohort promotion.
    class_id_snapshot = Column(Integer, ForeignKey("classes.id"), nullable=True, index=True)
    stream_id_snapshot = Column(Integer, ForeignKey("streams.id"), nullable=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True, index=True)
    device_user_id = Column(String(50), nullable=False, index=True)  # uid from device or phone identifier
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    event_type = Column(
        String(10),
        nullable=False,
        server_default=text("'UNKNOWN'"),
        index=True,
        comment="IN, OUT, or UNKNOWN",
    )
    source = Column(
        String(20),
        nullable=False,
        server_default=text("'k40_device'"),
        index=True,
        comment="k40_device or mobile_app",
    )
    raw_payload = Column(JSONB, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
    is_deleted = Column(Boolean, server_default=text("false"), nullable=False, index=True)

    # Relationships
    school = relationship("School", lazy="selectin")
    device = relationship("Device", lazy="selectin")
    student = relationship("Student", lazy="selectin")
    teacher = relationship("Teacher", lazy="selectin")

    __table_args__ = (
        {"comment": "Attendance records captured from biometric devices"},
    )

    def __repr__(self) -> str:
        return (
            f"<AttendanceRecord(id={self.id}, device_id={self.device_id}, "
            f"device_user_id='{self.device_user_id}', occurred_at={self.occurred_at})>"
        )
