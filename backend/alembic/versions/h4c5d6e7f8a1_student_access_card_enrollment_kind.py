"""student access_card_number; enrollment_sessions kind and nullable finger

Revision ID: h4c5d6e7f8a1
Revises: g3b4c5d6e7f9
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h4c5d6e7f8a1"
down_revision: Union[str, None] = "g3b4c5d6e7f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "students",
        sa.Column("access_card_number", sa.String(length=32), nullable=True),
    )
    op.create_index(
        op.f("ix_students_access_card_number"),
        "students",
        ["access_card_number"],
        unique=False,
    )
    op.add_column(
        "enrollment_sessions",
        sa.Column(
            "enrollment_kind",
            sa.String(length=20),
            server_default=sa.text("'fingerprint'"),
            nullable=False,
        ),
    )
    op.alter_column(
        "enrollment_sessions",
        "finger_id",
        existing_type=sa.INTEGER(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "enrollment_sessions",
        "finger_id",
        existing_type=sa.INTEGER(),
        nullable=False,
    )
    op.drop_column("enrollment_sessions", "enrollment_kind")
    op.drop_index(op.f("ix_students_access_card_number"), table_name="students")
    op.drop_column("students", "access_card_number")
