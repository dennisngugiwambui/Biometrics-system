"""Service for resetting a school's system back to a clean (default) state.

This wipes all operational data (students, teachers, attendance, enrollments,
templates, notifications, alumni, support tickets, classes/streams, device groups)
while KEEPING:
  - the school record
  - login users (admins) — so you can still sign in afterwards
  - device records — including ip_address / port / com_password, so device
    connections keep working with the same constant IP after a reset.

It also best-effort sends a factory-style clear command to each physical device so
on-device users and fingerprints are erased too.
"""

import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from device_service.repositories.device_repository import DeviceRepository
from device_service.services.device_connection import DeviceConnectionService

logger = logging.getLogger(__name__)

# Operational tables wiped on reset, in FK-safe order (children before parents).
# Each entry is a raw DELETE scoped to the school. Streams/ticket_messages have no
# direct school_id, so they are scoped through their parent.
_DELETE_STATEMENTS: list[str] = [
    "DELETE FROM fingerprint_templates WHERE school_id = :sid",
    "DELETE FROM enrollment_sessions WHERE school_id = :sid",
    "DELETE FROM attendance_records WHERE school_id = :sid",
    "DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE school_id = :sid)",
    "DELETE FROM support_tickets WHERE school_id = :sid",
    "DELETE FROM notifications WHERE school_id = :sid",
    "DELETE FROM alumni_records WHERE school_id = :sid",
    "DELETE FROM students WHERE school_id = :sid",
    "DELETE FROM streams WHERE class_id IN (SELECT id FROM classes WHERE school_id = :sid)",
    "DELETE FROM classes WHERE school_id = :sid",
    "DELETE FROM teachers WHERE school_id = :sid",
]


class SystemResetService:
    """Reset a school's system to a clean state (keeps admins + devices/IPs)."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.device_repository = DeviceRepository(db)
        self.connection_service = DeviceConnectionService(db)

    async def _clear_one_device(self, device) -> dict:
        """Best-effort wipe of a single physical device's users + attendance.

        pyzk ``clear_data`` is firmware-dependent and often leaves users behind, so we
        explicitly delete all users and attendance, then also call clear_data as a
        belt-and-braces step. Returns a per-device result dict.
        """
        conn = await self.connection_service.get_connection(device)
        if conn is None:
            return {"device_id": device.id, "name": device.name, "ok": False, "reason": "offline"}

        users_removed = 0
        errors: list[str] = []
        try:
            users_removed = await conn.delete_all_users_on_device()
        except Exception as e:  # noqa: BLE001
            errors.append(f"delete_users: {e}")
        try:
            await conn.clear_attendance_on_device()
        except Exception as e:  # noqa: BLE001
            errors.append(f"clear_attendance: {e}")
        try:
            await conn.clear_all_data_on_device()
        except Exception as e:  # noqa: BLE001
            # Non-fatal: users were already deleted explicitly above.
            errors.append(f"clear_data: {e}")

        ok = not errors or users_removed > 0
        result = {"device_id": device.id, "name": device.name, "ok": ok, "users_removed": users_removed}
        if errors:
            result["errors"] = errors
        return result

    async def _clear_physical_devices(self, school_id: int) -> dict:
        """Best-effort: wipe every device for the school. Never fatal."""
        devices, _ = await self.device_repository.list_devices(school_id, page=1, page_size=1000)
        results = [await self._clear_one_device(d) for d in devices]
        return {
            "total": len(devices),
            "cleared": [r["device_id"] for r in results if r.get("ok")],
            "failed": [r for r in results if not r.get("ok")],
            "details": results,
        }

    async def _wipe_database(self, school_id: int) -> dict[str, int]:
        """Delete all operational rows for a school; keep school, users, devices."""
        deleted: dict[str, int] = {}
        for stmt in _DELETE_STATEMENTS:
            table = stmt.split()[2]  # "DELETE FROM <table> ..."
            result = await self.db.execute(text(stmt), {"sid": school_id})
            deleted[table] = result.rowcount or 0

        # Keep devices, but detach from (now-deleted) device groups and reset counters
        # so the system reads as fresh. ip_address / port / com_password are untouched.
        await self.db.execute(
            text(
                "UPDATE devices SET device_group_id = NULL, enrolled_users = 0, "
                "last_sync = NULL, last_seen = NULL WHERE school_id = :sid"
            ),
            {"sid": school_id},
        )
        result = await self.db.execute(
            text("DELETE FROM device_groups WHERE school_id = :sid"), {"sid": school_id}
        )
        deleted["device_groups"] = result.rowcount or 0
        await self.db.commit()
        return deleted

    async def reset_school(self, school_id: int, *, scope: str = "both") -> dict:
        """
        Reset a school's data and/or physical devices.

        Args:
            school_id: School to reset
            scope: "system" (database only), "devices" (physical devices only),
                   or "both"

        Returns:
            Summary dict with the scope, device-clear results, and deleted row counts
        """
        if scope not in ("system", "devices", "both"):
            raise ValueError(f"Invalid reset scope: {scope}")

        device_result: Optional[dict] = None
        deleted: dict[str, int] = {}

        # Clear physical devices first (so a DB wipe doesn't lose device connection info
        # we rely on — devices are preserved in the DB regardless).
        if scope in ("devices", "both"):
            device_result = await self._clear_physical_devices(school_id)

        if scope in ("system", "both"):
            deleted = await self._wipe_database(school_id)

        logger.warning(
            "System reset (scope=%s) completed for school_id=%s (deleted=%s, devices=%s)",
            scope, school_id, deleted, device_result,
        )
        return {
            "school_id": school_id,
            "scope": scope,
            "devices": device_result,
            "deleted": deleted,
        }
