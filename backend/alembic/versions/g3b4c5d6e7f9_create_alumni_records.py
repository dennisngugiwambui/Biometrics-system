"""create alumni_records

Revision ID: g3b4c5d6e7f9
Revises: f2a3b4c5d6e8
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g3b4c5d6e7f9"
down_revision: Union[str, None] = "f2a3b4c5d6e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alumni_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("graduation_year", sa.Integer(), nullable=False),
        sa.Column("exit_class_name", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "graduation_year", name="uq_alumni_student_grad_year"),
    )
    op.create_index(op.f("ix_alumni_records_student_id"), "alumni_records", ["student_id"], unique=False)
    op.create_index(op.f("ix_alumni_records_school_id"), "alumni_records", ["school_id"], unique=False)
    op.create_index(op.f("ix_alumni_records_graduation_year"), "alumni_records", ["graduation_year"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_alumni_records_graduation_year"), table_name="alumni_records")
    op.drop_index(op.f("ix_alumni_records_school_id"), table_name="alumni_records")
    op.drop_index(op.f("ix_alumni_records_student_id"), table_name="alumni_records")
    op.drop_table("alumni_records")
