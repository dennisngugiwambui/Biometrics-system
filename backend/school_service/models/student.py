"""Student database model."""

import enum
from sqlalchemy import Column, Integer, String, Date, Enum, ForeignKey, Boolean, DateTime, UniqueConstraint, text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from shared.database.base import Base


class Gender(str, enum.Enum):
    """Gender enumeration."""

    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Student(Base):
    """Student model representing a student enrolled in a school."""

    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    admission_number = Column(String(50), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=True, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True, index=True)

    # active = on roll; graduated = finished top year (kept for records; hidden from default lists)
    enrollment_status = Column(
        String(20),
        server_default=text("'active'"),
        nullable=False,
        index=True,
    )
    graduated_at = Column(Date, nullable=True)

    # Parent contact information
    parent_phone = Column(String(20), nullable=True)
    parent_email = Column(String(255), nullable=True)

    # Enrollment type
    is_boarding = Column(Boolean, server_default=text("false"), nullable=False, index=True)

    # RFID / Mifare card number (decimal or hex string); pushed to ZKTeco via set_user(card=...)
    access_card_number = Column(String(32), nullable=True, index=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
    is_deleted = Column(Boolean, server_default=text("false"), nullable=False, index=True)

    # Relationships
    school = relationship("School", back_populates="students", lazy="selectin")
    class_ = relationship("AcademicClass", back_populates="students", lazy="selectin")
    stream = relationship("Stream", back_populates="students", lazy="selectin")
    enrollment_sessions = relationship("EnrollmentSession", back_populates="student", lazy="selectin")

    # Unique constraint: admission_number must be unique per school
    __table_args__ = (
        UniqueConstraint("school_id", "admission_number", name="uq_students_school_admission"),
        {"comment": "Students enrolled in schools"},
    )

    def __repr__(self) -> str:
        return f"<Student(id={self.id}, admission_number='{self.admission_number}', school_id={self.school_id})>"

