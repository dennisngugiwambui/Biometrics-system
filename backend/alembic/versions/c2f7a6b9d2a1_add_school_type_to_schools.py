"""Add school_type to schools

Revision ID: c2f7a6b9d2a1
Revises: 001
Create Date: 2026-02-21 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2f7a6b9d2a1"
down_revision: Union[str, None] = "27f8bcf26c9c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "schools",
        sa.Column(
            "school_type",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'mixed'"),
        ),
    )
    op.create_index(op.f("ix_schools_school_type"), "schools", ["school_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_schools_school_type"), table_name="schools")
    op.drop_column("schools", "school_type")
