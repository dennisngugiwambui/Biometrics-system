"""Add teacher_id to enrollment_sessions for teacher fingerprint enrollment (check-in/check-out).

Revision ID: a1b2c3d4e5f6
Revises: e8f9a0b1c2d3
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "enrollment_sessions",
        sa.Column("teacher_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_enrollment_sessions_teacher_id",
        "enrollment_sessions",
        "teachers",
        ["teacher_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_enrollment_sessions_teacher_id"),
        "enrollment_sessions",
        ["teacher_id"],
        unique=False,
    )
    # Make student_id nullable so one of (student_id, teacher_id) can be set
    op.alter_column(
        "enrollment_sessions",
        "student_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "enrollment_sessions",
        "student_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_index(op.f("ix_enrollment_sessions_teacher_id"), table_name="enrollment_sessions")
    op.drop_constraint("fk_enrollment_sessions_teacher_id", "enrollment_sessions", type_="foreignkey")
    op.drop_column("enrollment_sessions", "teacher_id")
