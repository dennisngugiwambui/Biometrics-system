"""Alembic migration — create teachers table.

Revision ID: f1a2b3c4d5e7
Revises: e1a2b3c4d5e6
Create Date: 2026-02-19 15:55:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = "f1a2b3c4d5e7"
down_revision: Union[str, None] = "e1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teachers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.String(length=30), nullable=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("subject", sa.String(length=150), nullable=True),
        sa.Column("department", sa.String(length=150), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
        # Phone must be unique per school
        sa.UniqueConstraint("school_id", "phone", name="uq_teachers_school_phone"),
        comment="Teachers registered in schools",
    )
    op.create_index(op.f("ix_teachers_id"), "teachers", ["id"], unique=False)
    op.create_index(op.f("ix_teachers_school_id"), "teachers", ["school_id"], unique=False)
    op.create_index(op.f("ix_teachers_employee_id"), "teachers", ["employee_id"], unique=False)
    op.create_index(op.f("ix_teachers_phone"), "teachers", ["phone"], unique=False)
    op.create_index(op.f("ix_teachers_is_active"), "teachers", ["is_active"], unique=False)
    op.create_index(op.f("ix_teachers_is_deleted"), "teachers", ["is_deleted"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_teachers_is_deleted"), table_name="teachers")
    op.drop_index(op.f("ix_teachers_is_active"), table_name="teachers")
    op.drop_index(op.f("ix_teachers_phone"), table_name="teachers")
    op.drop_index(op.f("ix_teachers_employee_id"), table_name="teachers")
    op.drop_index(op.f("ix_teachers_school_id"), table_name="teachers")
    op.drop_index(op.f("ix_teachers_id"), table_name="teachers")
    op.drop_table("teachers")
