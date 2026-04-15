"""Enrollment session database model."""

import enum
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from shared.database.base import Base


class EnrollmentStatus(str, enum.Enum):
    """Enrollment session status enumeration."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EnrollmentSession(Base):
    """Model for tracking enrollment sessions (student or teacher)."""

    __tablename__ = "enrollment_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    # 0-9 for fingerprint; NULL for card-only enrollment
    finger_id = Column(Integer, nullable=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    # fingerprint | card | card_and_fingerprint
    enrollment_kind = Column(String(20), server_default=text("'fingerprint'"), nullable=False)

    status = Column(String(20), server_default=text("'pending'"), nullable=False, index=True)
    error_message = Column(Text, nullable=True)

    # Template data (encrypted before storage)
    template_data = Column(Text, nullable=True)  # Encrypted fingerprint template
    quality_score = Column(Integer, nullable=True)  # 0-100

    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
    is_deleted = Column(Boolean, server_default=text("false"), nullable=False, index=True)

    # Relationships
    student = relationship("Student", back_populates="enrollment_sessions", lazy="selectin")
    teacher = relationship("Teacher", back_populates="enrollment_sessions", lazy="selectin")
    device = relationship("Device", back_populates="enrollment_sessions", lazy="selectin")
    school = relationship("School", lazy="selectin")

    def __repr__(self) -> str:
        return f"<EnrollmentSession(id={self.id}, session_id='{self.session_id}', student_id={self.student_id}, device_id={self.device_id}, status='{self.status}')>"
