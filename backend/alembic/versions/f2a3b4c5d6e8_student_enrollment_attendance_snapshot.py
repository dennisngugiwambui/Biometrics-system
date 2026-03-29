"""student enrollment status + attendance class/stream snapshot

Revision ID: f2a3b4c5d6e8
Revises: 4118e0a19b17
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a3b4c5d6e8"
down_revision: Union[str, None] = "4118e0a19b17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "students",
        sa.Column(
            "enrollment_status",
            sa.String(length=20),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_students_enrollment_status"),
        "students",
        ["enrollment_status"],
        unique=False,
    )
    op.add_column("students", sa.Column("graduated_at", sa.Date(), nullable=True))

    op.add_column(
        "attendance_records",
        sa.Column("class_id_snapshot", sa.Integer(), nullable=True),
    )
    op.add_column(
        "attendance_records",
        sa.Column("stream_id_snapshot", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_attendance_records_class_id_snapshot_classes",
        "attendance_records",
        "classes",
        ["class_id_snapshot"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_attendance_records_stream_id_snapshot_streams",
        "attendance_records",
        "streams",
        ["stream_id_snapshot"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_attendance_records_stream_id_snapshot_streams",
        "attendance_records",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_attendance_records_class_id_snapshot_classes",
        "attendance_records",
        type_="foreignkey",
    )
    op.drop_column("attendance_records", "stream_id_snapshot")
    op.drop_column("attendance_records", "class_id_snapshot")

    op.drop_index(op.f("ix_students_enrollment_status"), table_name="students")
    op.drop_column("students", "graduated_at")
    op.drop_column("students", "enrollment_status")
