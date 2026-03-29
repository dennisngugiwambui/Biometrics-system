"""Alumni registry row when a student completes the top rung (or bulk graduate)."""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from shared.database.base import Base


class AlumniRecord(Base):
    __tablename__ = "alumni_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    graduation_year = Column(Integer, nullable=False, index=True)
    exit_class_name = Column(String(200), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    student = relationship("Student", lazy="selectin")
    school = relationship("School", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("student_id", "graduation_year", name="uq_alumni_student_grad_year"),
    )
