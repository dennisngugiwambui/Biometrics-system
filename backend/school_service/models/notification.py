"""In-app notification database model."""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from shared.database.base import Base


class Notification(Base):
    """Notification model for system alerts and user messages."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False, server_default=text("'system'"))
    link = Column(String(255), nullable=True)  # Optional URL to navigate to
    
    is_read = Column(Boolean, server_default=text("false"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    school = relationship("School", lazy="selectin")
    user = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, title='{self.title}', is_read={self.is_read})>"
