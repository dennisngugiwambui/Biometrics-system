"""Commands waiting for a cloud (push) device to collect on its next check-in."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func, text

from shared.database.base import Base


class DevicePushCommand(Base):
    __tablename__ = "device_push_commands"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    command = Column(Text, nullable=False)
    kind = Column(String(30), nullable=True)
    status = Column(String(10), server_default=text("'pending'"), nullable=False)  # pending|sent|done|failed|expired
    return_code = Column(Integer, nullable=True)
    result = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    done_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
