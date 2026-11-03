"""Cloud (push/ADMS) mode for devices: terminals on any network call the server.

Revision ID: k7f8a9b0c1d2
Revises: j6e7f8a9b0c1
Create Date: 2026-10-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "k7f8a9b0c1d2"
down_revision: Union[str, None] = "j6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # direct = the server opens TCP 4370 to the device (same network);
    # cloud = the device calls /iclock/* over the internet.
    op.add_column("devices", sa.Column("connection_mode", sa.String(10), nullable=False, server_default="direct"))
    op.add_column("devices", sa.Column("push_last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("devices", sa.Column("push_remote_ip", sa.String(45), nullable=True))
    op.add_column("devices", sa.Column("push_info", postgresql.JSONB(), nullable=True))
    op.add_column("devices", sa.Column("push_users", postgresql.JSONB(), nullable=True))
    op.add_column("devices", sa.Column("push_att_stamp", sa.String(40), nullable=True))
    op.add_column("devices", sa.Column("push_op_stamp", sa.String(40), nullable=True))
    # A cloud device has no address the server can reach.
    op.alter_column("devices", "ip_address", existing_type=sa.String(45), nullable=True)

    op.create_table(
        "device_push_commands",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("device_id", sa.Integer(), sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("command", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(30), nullable=True),
        # pending → sent → done | failed; pending → expired
        sa.Column("status", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("return_code", sa.Integer(), nullable=True),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_device_push_commands_pending", "device_push_commands", ["device_id", "status", "id"])


def downgrade() -> None:
    op.drop_index("ix_device_push_commands_pending", table_name="device_push_commands")
    op.drop_table("device_push_commands")
    op.execute("UPDATE devices SET ip_address = '0.0.0.0' WHERE ip_address IS NULL")
    op.alter_column("devices", "ip_address", existing_type=sa.String(45), nullable=False)
    for col in ("push_op_stamp", "push_att_stamp", "push_users", "push_info", "push_remote_ip", "push_last_seen_at", "connection_mode"):
        op.drop_column("devices", col)
