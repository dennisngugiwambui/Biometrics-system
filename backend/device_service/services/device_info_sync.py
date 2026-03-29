"""Service for periodically syncing device information (time, capacity, etc.)."""

import asyncio
import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from device_service.models.device import Device, DeviceStatus
from device_service.services.device_info_service import DeviceInfoService
from device_service.services.device_status_broadcaster import broadcaster
from device_service.repositories.device_repository import DeviceRepository
from device_service.core.config import settings
from device_service.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class DeviceInfoSyncService:
    """Background service for periodically syncing device information."""
    
    def __init__(self):
        """Initialize device info sync service."""
        self.running = False
        self.sync_interval = 60  # 1 minute (60 seconds)
        self._task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start the device info sync service."""
        if self.running:
            logger.warning("Device info sync service already running")
            return
        
        self.running = True
        logger.info(f"Starting device info sync service (interval: {self.sync_interval}s)")
        
        # Start background task
        self._task = asyncio.create_task(self._run_sync_loop())
    
    async def stop(self):
        """Stop the device info sync service."""
        if not self.running:
            return
        
        logger.info("Stopping device info sync service")
        self.running = False
        
        # Cancel the background task
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        logger.info("Device info sync service stopped")
    
    def _is_db_connection_error(self, e: Exception) -> bool:
        """True if the exception is due to database (e.g. PostgreSQL) being unreachable."""
        msg = str(e).lower()
        return (
            isinstance(e, (OSError, ConnectionError))
            or "5432" in msg
            or "connect call failed" in msg
            or "connection refused" in msg
        )

    async def _run_sync_loop(self):
        """Main sync loop."""
        db_unavailable_logged = False
        while self.running:
            try:
                await self.sync_all_online_devices()
                db_unavailable_logged = False
            except asyncio.CancelledError:
                break
            except Exception as e:
                if self._is_db_connection_error(e):
                    if not db_unavailable_logged:
                        logger.warning(
                            "Database unavailable (is PostgreSQL running?). "
                            "Device info sync will retry every 30s until connected."
                        )
                        db_unavailable_logged = True
                else:
                    logger.error("Error in device info sync cycle: %s", e, exc_info=True)
            
            if self.running:
                try:
                    delay = 30 if db_unavailable_logged else self.sync_interval
                    await asyncio.sleep(delay)
                except asyncio.CancelledError:
                    break
    
    async def sync_all_online_devices(self):
        """Sync device information for all online devices."""
        # Create a new database session for this sync cycle
        async with AsyncSessionLocal() as db:
            try:
                repository = DeviceRepository(db)
                # Only sync online devices (they're the only ones we can connect to)
                # Get all active devices and filter for online status
                all_devices = await repository.get_all_active_devices()
                devices = [d for d in all_devices if d.status == DeviceStatus.ONLINE]
                
                if not devices:
                    logger.debug("No online devices to sync")
                    return
                
                logger.info(f"Syncing device info for {len(devices)} online devices")
                
                # Sync devices concurrently
                tasks = [self.sync_device_info(device, db) for device in devices]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Log summary
                success_count = sum(1 for r in results if r is True)
                error_count = sum(1 for r in results if isinstance(r, Exception))
                
                logger.info(
                    f"Device info sync complete: {success_count} successful, "
                    f"{error_count} errors"
                )
            except Exception as e:
                if not self._is_db_connection_error(e):
                    logger.error("Error syncing all devices: %s", e, exc_info=True)
                raise
    
    async def sync_device_info(self, device: Device, db: AsyncSession) -> bool:
        """
        Sync device information for a single device.
        
        Fetches device info (especially time) and broadcasts via WebSocket.
        
        Args:
            device: Device instance to sync
            db: Database session
        
        Returns:
            True if sync was successful, False otherwise
        """
        try:
            # Fetch device information
            info_service = DeviceInfoService(db)
            info = await info_service.fetch_all_device_info(device, update_serial=False)
            
            # Check if we got any meaningful info
            capacity = info.get("capacity")
            has_capacity = capacity and isinstance(capacity, dict) and any(capacity.values())
            has_other_info = any(
                v is not None 
                for k, v in info.items() 
                if k != "capacity"
            )
            has_info = has_capacity or has_other_info
            
            if not has_info:
                logger.debug(f"Device {device.id} returned no information (may be offline)")
                return False
            
            # Update capacity in database if available
            if capacity and isinstance(capacity, dict) and "users_cap" in capacity:
                max_users = capacity["users_cap"]
                if max_users and max_users > 0:
                    device.max_users = max_users
                    await db.commit()
                    await db.refresh(device)
                    logger.debug(f"Updated device {device.id} max_users to {max_users}")
            
            # Broadcast device info update via WebSocket
            try:
                await broadcaster.broadcast_device_info(
                    school_id=device.school_id,
                    device_id=device.id,
                    device_info={
                        "serial_number": info.get("serial_number"),
                        "device_name": info.get("device_name"),
                        "firmware_version": info.get("firmware_version"),
                        "device_time": info.get("device_time"),
                        "capacity": info.get("capacity"),
                    }
                )
                logger.debug(f"Broadcasted device info update for device {device.id} via WebSocket")
            except Exception as e:
                # Log but don't fail the sync if broadcasting fails
                logger.warning(f"Failed to broadcast device info update for device {device.id}: {e}")
            
            return True
            
        except Exception as e:
            logger.error(
                f"Error syncing device info for device {device.id} "
                f"({device.ip_address}:{device.port}): {e}",
                exc_info=True
            )
            return False
