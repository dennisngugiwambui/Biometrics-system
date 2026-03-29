"""merge_heads

Revision ID: 192673696e7c
Revises: a1b2c3d4e5f6, c2f7a6b9d2a1
Create Date: 2026-02-24 16:10:07.330037

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '192673696e7c'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'c2f7a6b9d2a1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

