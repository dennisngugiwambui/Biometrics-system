"""Repository for Device data access."""

from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Tuple

from device_service.models.device import Device, DeviceStatus
from shared.schemas.device import DeviceCreate, DeviceUpdate


class DeviceRepository:
    """Repository for Device database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, device_data: DeviceCreate, school_id: int) -> Device:
        """Create a new device."""
        device = Device(
            school_id=school_id,
            name=device_data.name,
            ip_address=device_data.ip_address,
            port=device_data.port,
            serial_number=device_data.serial_number,
            location=device_data.location,
            description=device_data.description,
            device_group_id=device_data.device_group_id,
        )
        self.db.add(device)
        await self.db.commit()
        await self.db.refresh(device)
        return device

    async def get_by_id(
        self, device_id: int, school_id: Optional[int] = None
    ) -> Optional[Device]:
        """
        Get device by ID.
        
        Args:
            device_id: Device ID
            school_id: Optional school ID to filter by (for authorization)
        
        Returns:
            Device instance or None if not found
        """
        query = select(Device).where(
            Device.id == device_id,
            Device.is_deleted == False
        )
        
        if school_id is not None:
            query = query.where(Device.school_id == school_id)
        
        query = query.options(selectinload(Device.school))
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_ip_port(
        self, ip_address: str, port: int, school_id: int
    ) -> Optional[Device]:
        """
        Get device by IP address and port within a school.
        
        Args:
            ip_address: Device IP address
            port: Device port
            school_id: School ID
        
        Returns:
            Device instance or None if not found
        """
        result = await self.db.execute(
            select(Device).where(
                Device.ip_address == ip_address,
                Device.port == port,
                Device.school_id == school_id,
                Device.is_deleted == False
            )
        )
        return result.scalar_one_or_none()

    async def get_by_serial_number(
        self, serial_number: str
    ) -> Optional[Device]:
        """
        Get device by serial number (global search).
        
        Args:
            serial_number: Device serial number
        
        Returns:
            Device instance or None if not found
        """
        result = await self.db.execute(
            select(Device).where(
                Device.serial_number == serial_number,
                Device.is_deleted == False
            )
        )
        return result.scalar_one_or_none()

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
            search: Optional search term (searches name, IP, serial number)
        
        Returns:
            Tuple of (list of devices, total count)
        """
        # Base query
        base_query = select(Device).where(
            Device.school_id == school_id,
            Device.is_deleted == False
        )
        
        # Apply filters
        if status is not None:
            base_query = base_query.where(Device.status == status)
        
        if device_group_id is not None:
            base_query = base_query.where(Device.device_group_id == device_group_id)
        
        if search:
            search_term = f"%{search.lower()}%"
            base_query = base_query.where(
                or_(
                    func.lower(Device.name).like(search_term),
                    func.lower(Device.ip_address).like(search_term),
                    func.lower(Device.serial_number).like(search_term),
                )
            )
        
        # Get total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = base_query.options(
            selectinload(Device.school)
        ).order_by(Device.created_at.desc()).offset(offset).limit(page_size)
        
        result = await self.db.execute(query)
        devices = result.scalars().all()
        
        return list(devices), total

    async def update(
        self, device_id: int, device_data: DeviceUpdate, school_id: Optional[int] = None
    ) -> Optional[Device]:
        """
        Update device information.
        
        Args:
            device_id: Device ID
            device_data: Update data
            school_id: Optional school ID to verify ownership
        
        Returns:
            Updated Device instance or None if not found
        """
        # Get existing device
        query = select(Device).where(
            Device.id == device_id,
            Device.is_deleted == False
        )
        
        if school_id is not None:
            query = query.where(Device.school_id == school_id)
        
        result = await self.db.execute(query)
        device = result.scalar_one_or_none()
        
        if not device:
            return None
        
        # Convert Pydantic model to dict, excluding unset fields
        update_dict = device_data.model_dump(exclude_unset=True)
        
        # Update fields
        for key, value in update_dict.items():
            setattr(device, key, value)
        
        await self.db.commit()
        await self.db.refresh(device)
        return device

    async def update_device_status(
        self,
        device_id: int,
        status: DeviceStatus,
        last_seen: Optional[datetime] = None,
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
        device = await self.get_by_id(device_id)
        
        if not device:
            return False
        
        device.status = status
        # Always update last_seen (allows clearing it with None)
        device.last_seen = last_seen
        
        await self.db.commit()
        await self.db.refresh(device)
        return True

    async def delete(self, device_id: int, school_id: Optional[int] = None) -> bool:
        """
        Soft delete a device.
        
        Args:
            device_id: Device ID
            school_id: Optional school ID to verify ownership
        
        Returns:
            True if deleted, False if not found
        """
        query = select(Device).where(
            Device.id == device_id,
            Device.is_deleted == False
        )
        
        if school_id is not None:
            query = query.where(Device.school_id == school_id)
        
        result = await self.db.execute(query)
        device = result.scalar_one_or_none()
        
        if not device:
            return False
        
        device.is_deleted = True
        await self.db.commit()
        return True

    async def list_ip_addresses_for_school(self, school_id: int) -> set[str]:
        """IPv4 addresses already assigned to devices in this school (non-deleted)."""
        result = await self.db.execute(
            select(Device.ip_address).where(
                Device.school_id == school_id,
                Device.is_deleted == False,  # noqa: E712
            )
        )
        return {row[0] for row in result.all() if row[0]}

    async def get_all_active_devices(self) -> List[Device]:
        """
        Get all active (non-deleted) devices.
        
        Used for health checks and monitoring.
        
        Returns:
            List of active devices
        """
        result = await self.db.execute(
            select(Device).where(Device.is_deleted == False)
        )
        return list(result.scalars().all())

