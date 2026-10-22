"""Add admin_user_id to enrollment_sessions for device-admin enrollment (privilege=14).

Revision ID: i5d6e7f8a2b3
Revises: h4c5d6e7f8a1
Create Date: 2026-06-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i5d6e7f8a2b3"
down_revision: Union[str, None] = "h4c5d6e7f8a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "enrollment_sessions",
        sa.Column("admin_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_enrollment_sessions_admin_user_id",
        "enrollment_sessions",
        "users",
        ["admin_user_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_enrollment_sessions_admin_user_id"),
        "enrollment_sessions",
        ["admin_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_enrollment_sessions_admin_user_id"), table_name="enrollment_sessions")
    op.drop_constraint("fk_enrollment_sessions_admin_user_id", "enrollment_sessions", type_="foreignkey")
    op.drop_column("enrollment_sessions", "admin_user_id")
