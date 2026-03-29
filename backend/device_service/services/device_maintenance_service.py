"""Destructive / operational maintenance commands for ZKTeco devices."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from device_service.repositories.device_repository import DeviceRepository
from device_service.services.device_connection import DeviceConnectionService
from device_service.services.device_capacity import DeviceCapacityService
from device_service.models.device import DeviceStatus
from device_service.exceptions import DeviceNotFoundError, DeviceOfflineError

logger = logging.getLogger(__name__)


class DeviceMaintenanceService:
    """Clear logs, wipe device data, delete users, restart — device must be online."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.device_repository = DeviceRepository(db)
        self.connection_service = DeviceConnectionService(db)

    async def _conn(self, device_id: int, school_id: int):
        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)
        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)
        return device, conn

    async def clear_attendance_logs(self, device_id: int, school_id: int) -> None:
        _, conn = await self._conn(device_id, school_id)
        try:
            await conn.clear_attendance_on_device()
        finally:
            await self.connection_service.disconnect_device(device_id)

    async def clear_all_device_data(self, device_id: int, school_id: int) -> None:
        _, conn = await self._conn(device_id, school_id)
        try:
            await conn.clear_all_data_on_device()
        finally:
            await self.connection_service.disconnect_device(device_id)
        try:
            await DeviceCapacityService(self.db).refresh_device_capacity(device_id)
        except Exception as e:
            logger.warning("clear_all_device_data: capacity refresh failed: %s", e)

    async def delete_user_on_device(
        self,
        device_id: int,
        school_id: int,
        *,
        uid: int,
        user_id: str = "",
    ) -> None:
        _, conn = await self._conn(device_id, school_id)
        try:
            await conn.delete_user_from_device(uid=uid, user_id=user_id or "")
        finally:
            await self.connection_service.disconnect_device(device_id)

    async def restart_device(self, device_id: int, school_id: int) -> None:
        _, conn = await self._conn(device_id, school_id)
        try:
            await conn.restart_device()
        finally:
            await self.connection_service.disconnect_device(device_id)

    async def delete_all_users_on_device(self, device_id: int, school_id: int) -> int:
        """Remove all user records from the device; refresh portal capacity from hardware."""
        _, conn = await self._conn(device_id, school_id)
        try:
            count = await conn.delete_all_users_on_device()
        finally:
            await self.connection_service.disconnect_device(device_id)
        try:
            await DeviceCapacityService(self.db).refresh_device_capacity(device_id)
        except Exception as e:
            logger.warning("delete_all_users: capacity refresh failed: %s", e)
        return count

    async def delete_all_fingerprints_on_device(self, device_id: int, school_id: int) -> int:
        """Strip all fingerprint templates; users may remain without biometrics."""
        _, conn = await self._conn(device_id, school_id)
        try:
            count = await conn.delete_all_fingerprint_templates_on_device()
        finally:
            await self.connection_service.disconnect_device(device_id)
        try:
            await DeviceCapacityService(self.db).refresh_device_capacity(device_id)
        except Exception as e:
            logger.warning("delete_all_fingerprints: capacity refresh failed: %s", e)
        return count

    async def remove_student_ids_from_school_devices(
        self,
        school_id: int,
        student_ids: list[int],
    ) -> dict:
        """
        For each school device that is online, delete users whose uid matches student_ids.

        Uses one connection per device; continues on per-student errors (user may not exist on device).
        """
        if not student_ids:
            return {"devices": [], "message": "no student_ids"}

        devices, _ = await self.device_repository.list_devices(
            school_id, page=1, page_size=300
        )
        out: list[dict] = []
        for dev in devices:
            entry: dict = {
                "device_id": dev.id,
                "device_name": dev.name,
                "status": dev.status.value if hasattr(dev.status, "value") else str(dev.status),
            }
            if dev.status != DeviceStatus.ONLINE:
                entry["skipped"] = "offline"
                out.append(entry)
                continue
            removed = 0
            errors: list[dict] = []
            try:
                _, conn = await self._conn(dev.id, school_id)
                try:
                    for sid in student_ids:
                        try:
                            await conn.delete_user_from_device(uid=sid, user_id=str(sid))
                            removed += 1
                        except Exception as ex:
                            errors.append({"student_id": sid, "detail": str(ex)})
                finally:
                    await self.connection_service.disconnect_device(dev.id)
                try:
                    await DeviceCapacityService(self.db).refresh_device_capacity(dev.id)
                except Exception as cap_e:
                    logger.warning("capacity refresh after bulk remove: %s", cap_e)
            except Exception as ex:
                errors.append({"detail": str(ex)})
            entry["removed_attempts"] = removed
            entry["errors"] = errors
            out.append(entry)

        return {"student_ids": student_ids, "devices": out}
