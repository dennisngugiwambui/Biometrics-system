"""Service layer for Device business logic."""

from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Tuple

from device_service.repositories.device_repository import DeviceRepository
from device_service.models.device import Device, DeviceStatus
from shared.schemas.device import DeviceCreate, DeviceUpdate


class DeviceService:
    """Service for Device business logic."""

    def __init__(self, db: AsyncSession):
        self.repository = DeviceRepository(db)
        self.db = db

    async def create_device(
        self, device_data: DeviceCreate, school_id: int
    ) -> Device:
        """
        Create a new device.
        
        Args:
            device_data: Device creation data
            school_id: School ID for the device
            
        Returns:
            Created Device instance
            
        Raises:
            ValueError: If IP/port combination or serial number already exists
        """
        # Check for duplicate IP/port combination within the school (cloud devices have no IP)
        existing_ip_port = device_data.ip_address and await self.repository.get_by_ip_port(
            ip_address=device_data.ip_address,
            port=device_data.port,
            school_id=school_id
        )
        if existing_ip_port:
            raise ValueError(
                f"Device with IP {device_data.ip_address} and port {device_data.port} already exists for this school"
            )
        
        # Check for duplicate serial number (if provided, globally unique)
        if device_data.serial_number:
            existing_serial = await self.repository.get_by_serial_number(
                serial_number=device_data.serial_number
            )
            if existing_serial:
                raise ValueError(
                    f"Device with serial number '{device_data.serial_number}' already exists"
                )
        
        # Create device
        device = await self.repository.create(device_data, school_id)
        if device.serial_number:
            from device_service.services.push_protocol import forget_unclaimed
            forget_unclaimed(device.serial_number)
        return device

    async def get_device_by_id(
        self, device_id: int, school_id: Optional[int] = None
    ) -> Optional[Device]:
        """
        Get device by ID.
        
        Args:
            device_id: Device ID
            school_id: Optional school ID for authorization
        
        Returns:
            Device instance or None if not found
        """
        return await self.repository.get_by_id(device_id, school_id)

    async def list_devices(
        self,
        school_id: int,
        page: int = 1,
        page_size: int = 50,
        status: Optional[DeviceStatus] = None,
        device_group_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Device], int]:
        """
        List devices with pagination and filtering.
        
        Args:
            school_id: School ID (required)
            page: Page number (1-indexed)
            page_size: Items per page
            status: Optional filter by device status
            device_group_id: Optional filter by device group
            search: Optional search term
        
        Returns:
            Tuple of (list of devices, total count)
        """
        return await self.repository.list_devices(
            school_id=school_id,
            page=page,
            page_size=page_size,
            status=status,
            device_group_id=device_group_id,
            search=search,
        )

    async def update_device(
        self, device_id: int, device_data: DeviceUpdate, school_id: Optional[int] = None
    ) -> Optional[Device]:
        """
        Update device information.
        
        Args:
            device_id: Device ID
            device_data: Update data
            school_id: Optional school ID for authorization
            
        Returns:
            Updated Device instance or None if not found
            
        Raises:
            ValueError: If IP/port combination or serial number conflicts
        """
        # Get existing device
        existing_device = await self.repository.get_by_id(device_id, school_id)
        if not existing_device:
            return None
        
        # Check for IP/port conflicts if IP or port is being updated
        update_dict = device_data.model_dump(exclude_unset=True)
        if "ip_address" in update_dict or "port" in update_dict:
            new_ip = update_dict.get("ip_address", existing_device.ip_address)
            new_port = update_dict.get("port", existing_device.port)
            
            # Check if another device (not this one) has this IP/port
            conflict_device = new_ip and await self.repository.get_by_ip_port(
                ip_address=new_ip,
                port=new_port,
                school_id=existing_device.school_id
            )
            if conflict_device and conflict_device.id != device_id:
                raise ValueError(
                    f"Device with IP {new_ip} and port {new_port} already exists for this school"
                )
        
        # Check for serial number conflicts if serial number is being updated
        if "serial_number" in update_dict and update_dict["serial_number"]:
            new_serial = update_dict["serial_number"]
            conflict_device = await self.repository.get_by_serial_number(new_serial)
            if conflict_device and conflict_device.id != device_id:
                raise ValueError(
                    f"Device with serial number '{new_serial}' already exists"
                )
        
        # Update device
        return await self.repository.update(device_id, device_data, school_id)

    async def update_device_status(
        self,
        device_id: int,
        status: DeviceStatus,
        last_seen: Optional = None,
    ) -> bool:
        """
        Update device status and last_seen timestamp.
        
        Args:
            device_id: Device ID
            status: New device status
            last_seen: Optional last_seen timestamp
        
        Returns:
            True if updated, False if device not found
        """
        return await self.repository.update_device_status(
            device_id=device_id,
            status=status,
            last_seen=last_seen,
        )

    async def delete_device(
        self, device_id: int, school_id: Optional[int] = None
    ) -> bool:
        """
        Soft delete a device.
        
        Args:
            device_id: Device ID
            school_id: Optional school ID for authorization
        
        Returns:
            True if deleted, False if not found
        """
        return await self.repository.delete(device_id, school_id)

