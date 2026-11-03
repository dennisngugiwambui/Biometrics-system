"""Device database model."""

import enum
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, Boolean, DateTime, Text, UniqueConstraint, TypeDecorator
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from shared.database.base import Base


class DeviceStatus(str, enum.Enum):
    """Device connection status enumeration."""

    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class DeviceStatusType(TypeDecorator):
    """TypeDecorator to handle DeviceStatus enum conversion."""
    
    impl = String
    cache_ok = True
    
    def __init__(self, length=20):
        super().__init__(length=length)
        self.enum_class = DeviceStatus
    
    def process_bind_param(self, value, dialect):
        """Convert enum instance to string value."""
        if value is None:
            return None
        if isinstance(value, DeviceStatus):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        """Convert string value back to enum instance."""
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return DeviceStatus(value)
            except ValueError:
                return value
        return value


class Device(Base):
    """Device model representing a biometric device registered in a school."""

    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6; empty for cloud devices (they call us)
    port = Column(Integer, nullable=False, server_default=text("4370"))  # Default ZKTeco port
    com_password = Column(String(20), nullable=True)  # Communication password for device authentication
    serial_number = Column(String(100), unique=True, nullable=True, index=True)
    location = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    # Device status and monitoring
    # Use custom TypeDecorator to store as String (allows lowercase values)
    # and handle conversion between DeviceStatus enum and string values
    status = Column(
        DeviceStatusType(length=20),
        server_default=text("'unknown'"),
        nullable=False,
        index=True,
    )
    last_seen = Column(DateTime(timezone=True), nullable=True)
    last_sync = Column(DateTime(timezone=True), nullable=True)

    # Device capacity (for enrollment tracking)
    max_users = Column(Integer, nullable=True)  # Max capacity from device
    enrolled_users = Column(Integer, server_default=text("0"), nullable=False)  # Current enrollment count

    # Group assignment (optional)
    device_group_id = Column(Integer, ForeignKey("device_groups.id"), nullable=True, index=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
    is_deleted = Column(Boolean, server_default=text("false"), nullable=False, index=True)

    # Connection: "direct" = the server opens TCP to ip_address:port (same network);
    # "cloud" = the device calls /iclock/* over the internet (services/push_protocol.py).
    connection_mode = Column(String(10), server_default=text("'direct'"), nullable=False)
    push_last_seen_at = Column(DateTime(timezone=True), nullable=True)
    push_remote_ip = Column(String(45), nullable=True)
    push_info = Column(JSONB, nullable=True)   # firmware, counts, capacities the device reported
    push_users = Column(JSONB, nullable=True)  # {pin: {name, card, role, fingers}} — what is on the device
    push_att_stamp = Column(String(40), nullable=True)
    push_op_stamp = Column(String(40), nullable=True)

    # Relationships
    school = relationship("School", back_populates="devices", lazy="selectin")
    device_group = relationship("DeviceGroup", back_populates="devices", lazy="selectin")
    enrollment_sessions = relationship("EnrollmentSession", back_populates="device", lazy="selectin")

    # Unique constraint: IP/port combination must be unique per school
    # Serial number is globally unique (if provided)
    __table_args__ = (
        UniqueConstraint("school_id", "ip_address", "port", name="uq_devices_school_ip_port"),
        {"comment": "Biometric devices registered in schools"},
    )

    def __repr__(self) -> str:
        return f"<Device(id={self.id}, name='{self.name}', ip_address='{self.ip_address}:{self.port}', school_id={self.school_id})>"

