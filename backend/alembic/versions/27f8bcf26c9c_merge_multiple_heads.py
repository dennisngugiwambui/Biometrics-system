"""merge multiple heads

Revision ID: 27f8bcf26c9c
Revises: bf860f722ced, f1a2b3c4d5e7
Create Date: 2026-02-20 00:11:00.063826

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '27f8bcf26c9c'
down_revision: Union[str, None] = ('bf860f722ced', 'f1a2b3c4d5e7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

