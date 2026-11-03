"""Platform owner accounts and school licenses (the /management console).

Revision ID: j6e7f8a9b0c1
Revises: i5d6e7f8a2b3
Create Date: 2026-10-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j6e7f8a9b0c1"
down_revision: Union[str, None] = "i5d6e7f8a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "platform_admins",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(100), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(150), nullable=False, server_default="Platform Owner"),
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_platform_admins_email"), "platform_admins", ["email"], unique=True)

    op.create_table(
        "school_licenses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("license_key", sa.String(40), nullable=False),
        sa.Column("certificate_no", sa.String(40), nullable=False),
        sa.Column("plan", sa.String(50), nullable=False, server_default="standard"),
        sa.Column("max_students", sa.Integer(), nullable=True),
        sa.Column("max_devices", sa.Integer(), nullable=True),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("expires_on", sa.Date(), nullable=False),
        # active | suspended | revoked
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("issued_by", sa.Integer(), sa.ForeignKey("platform_admins.id"), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("credentials_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_school_licenses_school_id"), "school_licenses", ["school_id"])
    op.create_index(op.f("ix_school_licenses_license_key"), "school_licenses", ["license_key"], unique=True)
    op.create_index(op.f("ix_school_licenses_certificate_no"), "school_licenses", ["certificate_no"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_school_licenses_certificate_no"), table_name="school_licenses")
    op.drop_index(op.f("ix_school_licenses_license_key"), table_name="school_licenses")
    op.drop_index(op.f("ix_school_licenses_school_id"), table_name="school_licenses")
    op.drop_table("school_licenses")
    op.drop_index(op.f("ix_platform_admins_email"), table_name="platform_admins")
    op.drop_table("platform_admins")
