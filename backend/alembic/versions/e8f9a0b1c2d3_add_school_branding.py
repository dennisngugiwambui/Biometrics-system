"""Add branding to schools (logo, theme colors, login bg) for cross-device persistence

Revision ID: e8f9a0b1c2d3
Revises: 8aae4eadf9a7
Create Date: 2026-02-23

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "8aae4eadf9a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "schools",
        sa.Column("branding", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("schools", "branding")
