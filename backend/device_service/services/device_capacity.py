"""Service for tracking and managing device capacity."""

import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from device_service.repositories.device_repository import DeviceRepository
from device_service.models.device import Device
from device_service.core.config import settings

logger = logging.getLogger(__name__)


class DeviceCapacityService:
    """Service for tracking and managing device capacity."""

    def __init__(self, db: AsyncSession):
        """Initialize device capacity service."""
        self.db = db
        self.repository = DeviceRepository(db)

    async def get_device_capacity(self, device_id: int) -> Optional[Dict[str, Any]]:
        """
        Get device capacity information.

        Args:
            device_id: Device ID

        Returns:
            Dictionary with capacity information, or None if device not found
        """
        device = await self.repository.get_by_id(device_id)

        if not device:
            return None

        max_users = device.max_users or 0
        enrolled_users = device.enrolled_users or 0
        available = max_users - enrolled_users if max_users > 0 else None
        percentage = (enrolled_users / max_users * 100) if max_users > 0 else None

        return {
            "device_id": device_id,
            "max_users": max_users if max_users > 0 else None,
            "enrolled_users": enrolled_users,
            "available": available,
            "percentage": round(percentage, 1) if percentage is not None else None,
            "is_full": max_users > 0 and enrolled_users >= max_users,
            "is_warning": percentage is not None and percentage >= 80,
            "is_critical": percentage is not None and percentage >= 95,
        }

    async def refresh_device_capacity(self, device_id: int) -> Optional[Dict[str, Any]]:
        """
        Refresh capacity from real device and update database.

        Fetches max_users capacity directly from the device using ZKTeco protocol.
        Falls back to simulation mode if SIMULATION_MODE is enabled.

        Args:
            device_id: Device ID

        Returns:
            Dictionary with updated capacity information, or None if device not found
        """
        device = await self.repository.get_by_id(device_id)

        if not device:
            return None

        # Handle simulation mode
        if settings.SIMULATION_MODE:
            # Simulate device capacity if not set
            if device.max_users is None or device.max_users == 0:
                # Simulate a common ZKTeco device capacity
                simulated_max = 1000
                device.max_users = simulated_max
                await self.db.commit()
                await self.db.refresh(device)
                logger.info(f"Set simulated max_users={simulated_max} for device {device_id}")
            return await self.get_device_capacity(device_id)

        # Real device mode - fetch capacity from device
        from device_service.services.device_info_service import DeviceInfoService
        from device_service.services.device_connection import DeviceConnectionService

        try:
            connection_service = DeviceConnectionService(self.db)
            info_service = DeviceInfoService(self.db, connection_service)

            # Fetch capacity from real device
            capacity_info = await info_service.fetch_device_capacity(device)

            if capacity_info and "users_cap" in capacity_info:
                # Update max_users in database using users_cap (maximum capacity)
                # users_cap is the maximum users the device can store
                max_users = capacity_info["users_cap"]
                if max_users and max_users > 0:
                    device.max_users = max_users
                    logger.info(
                        f"Updated device {device_id} max_users to {max_users} "
                        f"from real device (users_cap)"
                    )
                else:
                    logger.warning(
                        f"Device {device_id} returned invalid users_cap: {max_users}. "
                        f"Capacity info: {capacity_info}"
                    )
                # Current user count on device (list view uses this; detail page reads live info)
                if "users" in capacity_info and capacity_info["users"] is not None:
                    try:
                        device.enrolled_users = max(0, int(capacity_info["users"]))
                    except (TypeError, ValueError):
                        logger.warning(
                            "Device %s returned non-numeric users count: %r",
                            device_id,
                            capacity_info.get("users"),
                        )
                    await self.db.commit()
                    await self.db.refresh(device)
                elif max_users and max_users > 0:
                    await self.db.commit()
                    await self.db.refresh(device)
            elif capacity_info:
                logger.warning(
                    f"Device {device_id} capacity info missing 'users_cap' field. "
                    f"Available fields: {list(capacity_info.keys())}"
                )
            else:
                logger.warning(
                    f"Could not fetch capacity from device {device_id}. "
                    f"Keeping existing value: {device.max_users}"
                )

        except Exception as e:
            logger.error(
                f"Error refreshing capacity from device {device_id}: {e}",
                exc_info=True
            )
            # Don't fail - return current capacity from database
            logger.warning(
                f"Failed to refresh capacity from device {device_id}. "
                f"Returning current database value."
            )

        return await self.get_device_capacity(device_id)

    async def update_enrolled_count(
        self, device_id: int, enrolled_count: int
    ) -> Optional[Dict[str, Any]]:
        """
        Update enrolled users count for a device.

        Args:
            device_id: Device ID
            enrolled_count: New enrolled users count

        Returns:
            Dictionary with updated capacity information, or None if device not found
        """
        device = await self.repository.get_by_id(device_id)

        if not device:
            return None

        device.enrolled_users = max(0, enrolled_count)  # Ensure non-negative
        await self.db.commit()
        await self.db.refresh(device)

        return await self.get_device_capacity(device_id)

    async def increment_enrolled_count(self, device_id: int, increment: int = 1) -> Optional[Dict[str, Any]]:
        """
        Increment enrolled users count for a device.

        Args:
            device_id: Device ID
            increment: Amount to increment (default: 1)

        Returns:
            Dictionary with updated capacity information, or None if device not found
        """
        device = await self.repository.get_by_id(device_id)

        if not device:
            return None

        new_count = max(0, device.enrolled_users + increment)
        device.enrolled_users = new_count
        await self.db.commit()
        await self.db.refresh(device)

        return await self.get_device_capacity(device_id)

    async def decrement_enrolled_count(self, device_id: int, decrement: int = 1) -> Optional[Dict[str, Any]]:
        """
        Decrement enrolled users count for a device.

        Args:
            device_id: Device ID
            decrement: Amount to decrement (default: 1)

        Returns:
            Dictionary with updated capacity information, or None if device not found
        """
        device = await self.repository.get_by_id(device_id)

        if not device:
            return None

        new_count = max(0, device.enrolled_users - decrement)
        device.enrolled_users = new_count
        await self.db.commit()
        await self.db.refresh(device)

        return await self.get_device_capacity(device_id)

