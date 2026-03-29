"""Background service for periodically polling attendance logs from online devices."""

import asyncio
import logging
from typing import Optional

from device_service.models.device import Device, DeviceStatus
from device_service.repositories.device_repository import DeviceRepository
from device_service.services.attendance_ingestion_service import AttendanceIngestionService
from device_service.core.config import settings
from device_service.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class AttendancePollService:
    """
    Background service that periodically polls online devices for new attendance
    logs and ingests them automatically using the ingestion pipeline.
    """

    def __init__(self):
        self.running = False
        self.poll_interval = settings.ATTENDANCE_POLL_INTERVAL
        self.max_concurrency = settings.ATTENDANCE_POLL_CONCURRENCY
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the polling service."""
        if self.running:
            logger.warning("Attendance poll service already running")
            return

        self.running = True
        logger.info(
            f"Starting attendance poll service "
            f"(interval: {self.poll_interval}s, concurrency: {self.max_concurrency})"
        )
        self._task = asyncio.create_task(self._run_poll_loop())

    async def stop(self):
        """Stop the polling service gracefully."""
        if not self.running:
            return

        logger.info("Stopping attendance poll service")
        self.running = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        logger.info("Attendance poll service stopped")

    def _is_db_connection_error(self, e: Exception) -> bool:
        """True if the exception is due to database (e.g. PostgreSQL) being unreachable."""
        msg = str(e).lower()
        return (
            isinstance(e, (OSError, ConnectionError))
            or "5432" in msg
            or "connect call failed" in msg
            or "connection refused" in msg
        )

    async def _run_poll_loop(self):
        """Main polling loop."""
        db_unavailable_logged = False
        while self.running:
            try:
                await self._poll_all_devices()
                db_unavailable_logged = False
            except asyncio.CancelledError:
                break
            except Exception as e:
                if self._is_db_connection_error(e):
                    if not db_unavailable_logged:
                        logger.warning(
                            "Database unavailable (is PostgreSQL running?). "
                            "Attendance poll will retry every 30s until connected."
                        )
                        db_unavailable_logged = True
                else:
                    logger.error("Error in attendance poll cycle: %s", e, exc_info=True)

            if self.running:
                try:
                    delay = 30 if db_unavailable_logged else self.poll_interval
                    await asyncio.sleep(delay)
                except asyncio.CancelledError:
                    break

    async def _poll_all_devices(self):
        """Poll all online devices for attendance logs, with bounded concurrency."""
        async with AsyncSessionLocal() as db:
            try:
                repository = DeviceRepository(db)
                all_devices = await repository.get_all_active_devices()
                online_devices = [d for d in all_devices if d.status == DeviceStatus.ONLINE]

                if not online_devices:
                    logger.debug("No online devices to poll for attendance")
                    return

                logger.info(f"Polling attendance from {len(online_devices)} online device(s)")

                semaphore = asyncio.Semaphore(self.max_concurrency)
                tasks = [
                    self._poll_device(device, semaphore) for device in online_devices
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                total_inserted = 0
                error_count = 0
                for r in results:
                    if isinstance(r, Exception):
                        error_count += 1
                    elif isinstance(r, int):
                        total_inserted += r

                logger.info(
                    f"Attendance poll complete: {total_inserted} new records, "
                    f"{error_count} device error(s)"
                )
            except Exception as e:
                if not self._is_db_connection_error(e):
                    logger.error("Error polling all devices: %s", e, exc_info=True)
                raise

    async def _poll_device(self, device: Device, semaphore: asyncio.Semaphore) -> int:
        """
        Poll a single device for attendance logs (bounded by semaphore).

        Returns number of new records inserted.
        """
        async with semaphore:
            # Each device gets its own DB session to isolate transactions
            async with AsyncSessionLocal() as db:
                try:
                    service = AttendanceIngestionService(db)
                    summary = await service.ingest_for_device(
                        device_id=device.id,
                        school_id=device.school_id,
                    )
                    if summary.inserted > 0 or summary.duplicates_filtered > 0:
                        logger.info(
                            f"Device {device.id} ({device.name}): "
                            f"{summary.inserted} new, {summary.skipped} existing, "
                            f"{summary.duplicates_filtered} dup taps filtered, "
                            f"{summary.total} total"
                        )
                    return summary.inserted
                except Exception as e:
                    logger.warning(
                        f"Failed to poll device {device.id} ({device.name}): {e}"
                    )
                    raise
