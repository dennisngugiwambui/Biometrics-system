"""Support ticket models."""

import secrets
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from shared.database.base import Base


class SupportTicket(Base):
    """A support ticket created by a school admin."""

    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Ticket details
    subject = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, default="general")
    priority = Column(String(20), nullable=False, default="medium")
    status = Column(String(20), nullable=False, default="open", index=True)

    # User info (denormalized for non-auth admin access)
    reporter_name = Column(String(200), nullable=True)
    reporter_email = Column(String(255), nullable=False, index=True)

    # Secure token for admin guest access (no login required)
    access_token = Column(String(64), nullable=False, unique=True, index=True,
                          default=lambda: secrets.token_urlsafe(48))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    messages = relationship("TicketMessage", back_populates="ticket",
                            cascade="all, delete-orphan", lazy="selectin",
                            order_by="TicketMessage.created_at")

    def __repr__(self) -> str:
        return f"<SupportTicket(id={self.id}, subject='{self.subject}', status='{self.status}')>"


class TicketMessage(Base):
    """A message/reply within a support ticket thread."""

    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"),
                       nullable=False, index=True)

    # Sender info
    sender_name = Column(String(200), nullable=False)
    sender_email = Column(String(255), nullable=False)
    is_admin_reply = Column(Boolean, nullable=False, default=False)

    # Content
    body = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="messages")

    def __repr__(self) -> str:
        return f"<TicketMessage(id={self.id}, ticket_id={self.ticket_id})>"
