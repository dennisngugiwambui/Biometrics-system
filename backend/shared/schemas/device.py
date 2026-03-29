"""Pydantic schemas for Device."""

from pydantic import BaseModel, Field, field_validator, IPvAnyAddress
from typing import Optional
from datetime import datetime
from enum import Enum


class DeviceStatus(str, Enum):
    """Device status enumeration for Pydantic validation."""

    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class DeviceBase(BaseModel):
    """Base schema with common device fields."""

    name: str = Field(..., min_length=1, max_length=200, description="Device display name")
    ip_address: str = Field(..., description="Device IP address (IPv4 or IPv6)")
    port: int = Field(default=4370, ge=1, le=65535, description="Device port (default: 4370)")
    com_password: Optional[str] = Field(None, max_length=20, description="Communication password for device authentication")
    serial_number: Optional[str] = Field(None, max_length=100, description="Device serial number")
    location: Optional[str] = Field(None, max_length=200, description="Device location")
    description: Optional[str] = Field(None, description="Device description")

    @field_validator("ip_address")
    @classmethod
    def validate_ip_address(cls, v: str) -> str:
        """Validate IP address format."""
        try:
            IPvAnyAddress(v)
            return v
        except Exception:
            raise ValueError("Invalid IP address format")


class DeviceCreate(DeviceBase):
    """Schema for creating a new device."""

    device_group_id: Optional[int] = Field(None, description="Optional device group ID")


class DeviceUpdate(BaseModel):
    """Schema for updating device (all fields optional)."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    ip_address: Optional[str] = None
    port: Optional[int] = Field(None, ge=1, le=65535)
    com_password: Optional[str] = Field(None, max_length=20, description="Communication password for device authentication")
    serial_number: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    device_group_id: Optional[int] = None

    @field_validator("ip_address")
    @classmethod
    def validate_ip_address(cls, v: Optional[str]) -> Optional[str]:
        """Validate IP address format if provided."""
        if v is None:
            return v
        try:
            IPvAnyAddress(v)
            return v
        except Exception:
            raise ValueError("Invalid IP address format")


class DeviceResponse(DeviceBase):
    """Schema for device response."""

    id: int
    school_id: int
    status: DeviceStatus
    last_seen: Optional[datetime] = None
    last_sync: Optional[datetime] = None
    max_users: Optional[int] = None
    enrolled_users: int = 0
    device_group_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeviceListResponse(BaseModel):
    """Paginated list of devices."""

    items: list[DeviceResponse]
    total: int
    page: int
    page_size: int
    pages: int


class DeviceConnectionTest(BaseModel):
    """Schema for connection test request."""

    timeout: Optional[int] = Field(
        default=5, ge=1, le=30, description="Connection timeout in seconds"
    )


class DeviceSerialResponse(BaseModel):
    """Response schema for device serial number fetch."""

    serial_number: str = Field(..., description="Device serial number")
    device_id: int = Field(..., description="Device ID")
    updated: bool = Field(..., description="Whether serial number was updated in database")


class DeviceConnectionTestByAddress(BaseModel):
    """Schema for connection test by IP address and port (before device creation)."""

    ip_address: str = Field(..., description="Device IP address (IPv4 or IPv6)")
    port: int = Field(..., ge=1, le=65535, description="Device port")
    com_password: Optional[str] = Field(None, max_length=20, description="Communication password (optional)")
    timeout: Optional[int] = Field(
        default=5, ge=1, le=30, description="Connection timeout in seconds"
    )

    @field_validator("ip_address")
    @classmethod
    def validate_ip_address(cls, v: str) -> str:
        """Validate IP address format."""
        try:
            IPvAnyAddress(v)
            return v
        except Exception:
            raise ValueError("Invalid IP address format")


class DeviceSubnetSetupHint(BaseModel):
    """Suggested values for one LAN (derived from a host interface)."""

    your_pc_or_server_ip: str = Field(
        ...,
        description="IPv4 seen on the machine running the device service (not the K40)",
    )
    subnet_mask: str = Field(default="255.255.255.0", description="Usually 255.255.255.0 on home routers")
    suggested_gateway: str = Field(..., description="Often the router, e.g. 192.168.1.1")
    suggested_k40_ip: str = Field(
        ...,
        description="Use this IP on the K40 itself; register the same IP when adding the device",
    )
    dns_suggestion: str = Field(
        ...,
        description="Primary DNS — using the gateway is fine for local-only setups",
    )


class DeviceNetworkSetupHintsResponse(BaseModel):
    """Help text and suggested IPs for ZKTeco Ethernet setup."""

    registered_device_ips: list[str] = Field(
        default_factory=list,
        description="IPs already used by devices in this school (excluded from suggestions)",
    )
    tcp_port: int = Field(default=4370, description="ZKTeco default TCP port")
    menu_path: str = Field(
        default="Communication → Ethernet",
        description="Typical path on ZKTeco terminals (may vary by firmware)",
    )
    subnets: list[DeviceSubnetSetupHint] = Field(
        default_factory=list,
        description="One row per private IPv4 interface detected on this server",
    )
    warnings: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(
        default_factory=lambda: [
            "The K40 must have its own IP address — never the same as your PC or the server.",
            "In the dashboard, enter the K40's IP (the one you set on the device), not your PC's IP.",
            "Subnet mask and gateway on the K40 must match your router's LAN (same as your PC's Wi‑Fi settings).",
            "TCP port must be 4370 unless you changed it on the device.",
            "The PC running the browser can differ from the server: the server must be able to open TCP 4370 to the K40.",
            "Suggested device IPs skip addresses already used by other devices in this school.",
        ],
    )


class DeviceConnectionTestResponse(BaseModel):
    """Schema for connection test response."""

    success: bool
    message: str
    device_info: Optional[dict] = None  # Device information if connection successful
    response_time_ms: Optional[int] = None
    troubleshooting_tips: Optional[list[str]] = Field(
        default=None,
        description="Optional hints when the test fails (e.g. IP conflict with server)",
    )


class DeviceInfoResponse(BaseModel):
    """Response schema for comprehensive device information."""

    serial_number: Optional[str] = Field(None, description="Device serial number")
    device_name: Optional[str] = Field(None, description="Device model/name")
    firmware_version: Optional[str] = Field(None, description="Firmware version")
    device_time: Optional[str] = Field(None, description="Device current time")
    capacity: Optional[dict] = Field(None, description="Device capacity information")
    device_id: int = Field(..., description="Device ID")


class DeviceTimeResponse(BaseModel):
    """Response schema for device time."""

    device_time: str = Field(..., description="Device current time")
    server_time: str = Field(..., description="Server current time (ISO 8601)")
    time_difference_seconds: Optional[float] = Field(None, description="Time difference in seconds (device - server)")
    device_id: int = Field(..., description="Device ID")

