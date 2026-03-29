"""Teacher database model."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from shared.database.base import Base


class Teacher(Base):
    """
    Teacher model representing a staff member who signs in/out daily via biometric.

    employee_id is auto-generated as TID-{school_id}-{id:04d} after creation.
    phone is unique within a school (no two teachers share a phone number).
    """

    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)

    # Auto-generated teacher identifier: TID-{SCHOOLID}-{0001}
    employee_id = Column(String(30), nullable=True, index=True)

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)

    # Contact — phone must be unique per school
    phone = Column(String(20), nullable=False, index=True)
    email = Column(String(255), nullable=True)

    # Professional details
    subject = Column(JSON, nullable=True, comment="List of subjects taught")
    department = Column(String(150), nullable=True)

    # Status
    is_active = Column(Boolean, server_default=text("true"), nullable=False, index=True)
    is_deleted = Column(Boolean, server_default=text("false"), nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )

    # Relationships
    school = relationship("School", lazy="selectin")
    enrollment_sessions = relationship(
        "EnrollmentSession",
        back_populates="teacher",
        lazy="selectin",
        foreign_keys="EnrollmentSession.teacher_id",
    )

    __table_args__ = (
        {"comment": "Teachers registered in schools — each has a unique phone per school"},
    )

    def __repr__(self) -> str:
        return f"<Teacher(id={self.id}, employee_id='{self.employee_id}', name='{self.first_name} {self.last_name}')>"
