"""Add po_box and notification_settings to schools

Revision ID: a1b2c3d4e5f7
Revises: 192673696e7c
Create Date: 2026-02-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "192673696e7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("schools", sa.Column("po_box", sa.String(50), nullable=True))
    op.add_column("schools", sa.Column("notification_settings", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("schools", "notification_settings")
    op.drop_column("schools", "po_box")
