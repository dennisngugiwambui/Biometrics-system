"""Service for ingesting attendance logs from devices into the database.

Pipeline:
  1. Fetch raw logs from device
  2. Deduplicate against existing DB records AND in-memory processed cache
  3. Resolve device_user_id → student_id (StudentMatchingService)
  4. Determine IN / OUT / DUPLICATE for each record (EntryExitService)
  5. Insert non-duplicate records; broadcast ALL new scans (including duplicates)
     via WebSocket for the live capture feed.

The in-memory cache (``_processed_scan_keys``) prevents DUPLICATE scans — which
are broadcast but never stored in the database — from being re-broadcast on
subsequent poll cycles when the device returns the same log dump.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import httpx
import pytz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from device_service.core.config import settings

# ---------------------------------------------------------------------------
# Module-level per-device cache of processed scan keys.
#
# The ZKTeco device always returns ALL its logs on every poll.  DB dedup
# catches stored records (IN/OUT/UNKNOWN), but DUPLICATE scans are never
# stored so they would pass DB dedup every poll cycle and get re-broadcast
# in an infinite loop.  This cache stores ALL processed keys — including
# duplicates — so they are only broadcast once.
#
# Key:   device_id (int)
# Value: set of (device_user_id: str, occurred_at: datetime)
# ---------------------------------------------------------------------------
_processed_scan_keys: dict[int, set[tuple[str, datetime]]] = {}
_PROCESSED_KEYS_MAX_PER_DEVICE = 5000

from attendance_service.models.attendance_record import AttendanceRecord, EventType
from shared.schemas.attendance import IngestionSummaryResponse

from device_service.models.device import DeviceStatus
from device_service.repositories.device_repository import DeviceRepository
from device_service.repositories.attendance_record_repository import AttendanceRecordRepository
from device_service.services.device_info_service import DeviceInfoService
from device_service.services.student_matching_service import StudentMatchingService
from device_service.services.teacher_matching_service import TeacherMatchingService
from device_service.services.entry_exit_service import EntryExitService, Determination
from device_service.exceptions import DeviceNotFoundError, DeviceOfflineError
from device_service.services.attendance_broadcaster import attendance_broadcaster
from school_service.models.student import Student

logger = logging.getLogger(__name__)


async def _trigger_parent_notifications(school_id: int, events: list[dict]) -> None:
    """Call gateway internal endpoint to send parent SMS/WhatsApp for attendance events. Best-effort."""
    url = f"{settings.API_GATEWAY_URL.rstrip('/')}/api/v1/notifications/trigger-attendance-internal"
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            r = await client.post(
                url,
                json={"school_id": school_id, "events": events},
                headers={"X-Internal-Key": settings.NOTIFICATION_INTERNAL_KEY},
            )
            if r.status_code == 200:
                data = r.json()
                logger.info(
                    "Parent notifications: %s sent, %s failed (school %s)",
                    data.get("sent", 0),
                    data.get("failed", 0),
                    school_id,
                )
            else:
                logger.warning("Parent notifications trigger returned %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("Failed to trigger parent notifications: %s", e)


@dataclass
class IngestionSummary:
    """Summary of attendance ingestion result."""

    inserted: int
    skipped: int
    duplicates_filtered: int = 0
    total: int = 0


class AttendanceIngestionService:
    """Service for fetching and ingesting attendance logs from devices.

    Orchestrates: fetch → dedupe → student matching → entry/exit → insert.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.device_repo = DeviceRepository(db)
        self.attendance_repo = AttendanceRecordRepository(db)
        self.device_info_service = DeviceInfoService(db)
        self.student_matcher = StudentMatchingService(db)
        self.teacher_matcher = TeacherMatchingService(db)
        self.entry_exit = EntryExitService(db)

    async def ingest_for_device(
        self,
        device_id: int,
        school_id: int,
    ) -> IngestionSummary:
        """
        Fetch attendance logs from device and store new records.

        Full pipeline:
          1. Fetch raw logs from the physical device.
          2. Deduplicate against existing DB records (by device_user_id + occurred_at).
          3. Resolve device_user_id → student_id via StudentMatchingService.
          4. For each matched student, determine IN/OUT/DUPLICATE via EntryExitService.
             Unmatched records get event_type=UNKNOWN.
          5. Filter out DUPLICATE taps.
          6. Bulk-insert remaining records.

        Returns:
            IngestionSummary with inserted, skipped, duplicates_filtered, total.

        Raises:
            DeviceNotFoundError: If device not found or not in school.
            DeviceOfflineError: If device is offline.
        """
        device = await self.device_repo.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)

        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)

        try:
            # ----------------------------------------------------------
            # 1. Fetch raw logs & normalize naive timestamps to tz-aware
            # ----------------------------------------------------------
            logs = await self.device_info_service.fetch_attendance_logs(device)
            total = len(logs)
            if total == 0:
                return IngestionSummary(inserted=0, skipped=0, duplicates_filtered=0, total=0)

            device_tz = pytz.timezone(settings.ATTENDANCE_TIMEZONE)
            for rec in logs:
                ts = rec.get("timestamp")
                if ts is not None and ts.tzinfo is None:
                    rec["timestamp"] = device_tz.localize(ts)

            # ----------------------------------------------------------
            # 2. Deduplicate against existing DB records + memory cache
            # ----------------------------------------------------------
            keys = [
                (rec.get("user_id") or "", rec["timestamp"])
                for rec in logs
                if rec.get("timestamp")
            ]
            existing_in_db = await self.attendance_repo.find_existing_keys(
                device_id, school_id, keys,
            )

            # Also check the in-memory cache (catches DUPLICATE scans that
            # were broadcast but never stored in DB on a previous poll).
            device_cache = _processed_scan_keys.get(device_id, set())
            existing_in_cache = device_cache.intersection(keys)
            already_seen = existing_in_db | existing_in_cache
            skipped = len(already_seen)

            # Filter to only genuinely new records and sort chronologically
            new_logs = [
                rec for rec in logs
                if rec.get("timestamp")
                and (rec.get("user_id") or "", rec["timestamp"]) not in already_seen
            ]
            new_logs.sort(key=lambda r: r["timestamp"])

            if not new_logs:
                return IngestionSummary(inserted=0, skipped=skipped, duplicates_filtered=0, total=total)

            # ----------------------------------------------------------
            # 3. Resolve device_user_id → student_id / teacher_id
            # ----------------------------------------------------------
            device_user_ids = [rec.get("user_id") or "" for rec in new_logs]
            student_map = await self.student_matcher.resolve_batch(school_id, device_user_ids)
            teacher_map = await self.teacher_matcher.resolve_batch(school_id, device_user_ids)

            placement: dict[int, tuple[Optional[int], Optional[int]]] = {}
            unique_sids = {int(sid) for sid in student_map.values() if sid is not None}
            if unique_sids:
                pr = await self.db.execute(
                    select(Student.id, Student.class_id, Student.stream_id).where(
                        Student.id.in_(unique_sids),
                        Student.school_id == school_id,
                    )
                )
                for row in pr.all():
                    placement[int(row.id)] = (row.class_id, row.stream_id)

            # ----------------------------------------------------------
            # 4. Get last-record-today for matched users (seed the cache)
            # ----------------------------------------------------------
            matched_student_ids = list(set(student_map.values()))
            matched_teacher_ids = list(set(teacher_map.values()))
            last_student_cache: dict[int, tuple[str, ...]] = {}
            last_teacher_cache: dict[int, tuple[str, ...]] = {}
            reference_time = new_logs[0]["timestamp"]
            if matched_student_ids:
                last_student_cache = await self.entry_exit.get_last_records_for_students(
                    school_id, matched_student_ids, reference_time,
                )
            if matched_teacher_ids:
                last_teacher_cache = await self.entry_exit.get_last_records_for_teachers(
                    school_id, matched_teacher_ids, reference_time,
                )

            # ----------------------------------------------------------
            # 5. Process each record: determine event_type
            #    - ALL scans go into all_scans (for WS live broadcast)
            #    - Only non-duplicate scans go into to_insert (for DB)
            # ----------------------------------------------------------
            to_insert: list[AttendanceRecord] = []
            all_scans: list[dict] = []  # ALL events including duplicates
            duplicates_filtered = 0

            for rec in new_logs:
                uid = rec.get("user_id") or ""
                ts = rec["timestamp"]
                student_id = student_map.get(uid)
                teacher_id = teacher_map.get(uid)
                is_duplicate = False

                # Determine which subject this scan belongs to.
                # If both maps match (shouldn't happen), prefer teacher mapping.
                if teacher_id is not None:
                    previous = last_teacher_cache.get(teacher_id)
                    determination = self.entry_exit.determine_from_previous(previous, ts)
                    if determination == Determination.DUPLICATE:
                        event_type = "DUPLICATE"
                        is_duplicate = True
                        duplicates_filtered += 1
                    else:
                        event_type = determination.value
                        last_teacher_cache[teacher_id] = (event_type, ts)
                elif student_id is not None:
                    previous = last_student_cache.get(student_id)
                    determination = self.entry_exit.determine_from_previous(previous, ts)
                    if determination == Determination.DUPLICATE:
                        event_type = "DUPLICATE"
                        is_duplicate = True
                        duplicates_filtered += 1
                    else:
                        event_type = determination.value
                        last_student_cache[student_id] = (event_type, ts)
                else:
                    event_type = EventType.UNKNOWN

                # Always add to all_scans for live broadcast
                all_scans.append({
                    "scan_id": str(uuid.uuid4()),
                    "device_user_id": uid,
                    "student_id": student_id,
                    "teacher_id": teacher_id,
                    "timestamp": ts,
                    "event_type": event_type,
                    "device_id": device_id,
                })

                # Only insert non-duplicates to DB
                if not is_duplicate:
                    raw = {
                        "punch": rec.get("punch"),
                        "device_serial": rec.get("device_serial"),
                    }
                    snap_c: Optional[int] = None
                    snap_s: Optional[int] = None
                    if student_id is not None and student_id in placement:
                        snap_c, snap_s = placement[student_id]
                    to_insert.append(
                        AttendanceRecord(
                            school_id=school_id,
                            device_id=device_id,
                            student_id=student_id,
                            teacher_id=teacher_id,
                            class_id_snapshot=snap_c,
                            stream_id_snapshot=snap_s,
                            device_user_id=uid,
                            occurred_at=ts,
                            event_type=event_type,
                            raw_payload=raw,
                        )
                    )

            # ----------------------------------------------------------
            # 6. Bulk insert (non-duplicate records only)
            # ----------------------------------------------------------
            inserted = await self.attendance_repo.bulk_insert_enriched(to_insert)

            summary = IngestionSummary(
                inserted=inserted,
                skipped=skipped,
                duplicates_filtered=duplicates_filtered,
                total=total,
            )

            # Validate response before committing
            IngestionSummaryResponse.model_validate(summary.__dict__)
            await self.db.commit()

            # ----------------------------------------------------------
            # 7. Broadcast ALL scans via WebSocket (after commit, best-effort)
            #    Includes IN, OUT, UNKNOWN, and DUPLICATE events so the
            #    live capture feed shows every fingerprint tap instantly.
            # ----------------------------------------------------------
            if all_scans:
                try:
                    enriched_events = await self._build_live_scan_events(
                        all_scans, device,
                    )
                    await attendance_broadcaster.broadcast_events(school_id, enriched_events)
                except Exception as ws_err:
                    logger.warning("Failed to broadcast attendance events: %s", ws_err)

            # ----------------------------------------------------------
            # 7b. Trigger parent notifications (SMS/WhatsApp) for inserted student check-in/out
            #     Best-effort: do not fail ingestion if gateway or key is unavailable.
            # ----------------------------------------------------------
            if to_insert and settings.NOTIFICATION_INTERNAL_KEY and settings.API_GATEWAY_URL:
                student_events = [
                        {
                            "school_id": school_id,
                            "student_id": rec.student_id,
                            "teacher_id": rec.teacher_id,
                            "event_type": rec.event_type.value if hasattr(rec.event_type, "value") else str(rec.event_type),
                            "occurred_at": rec.occurred_at.isoformat() if rec.occurred_at else "",
                        }
                        for rec in to_insert
                        if rec.student_id is not None
                        and rec.event_type in (EventType.IN, EventType.OUT)
                    ]
                if student_events:
                    asyncio.create_task(
                        _trigger_parent_notifications(school_id, student_events),
                    )

            # ----------------------------------------------------------
            # 8. Update in-memory cache with ALL processed scan keys
            #    so they are not re-processed on the next poll cycle.
            # ----------------------------------------------------------
            cache = _processed_scan_keys.setdefault(device_id, set())
            for rec in new_logs:
                cache.add((rec.get("user_id") or "", rec["timestamp"]))

            # Trim cache if it grows too large (keep newest entries)
            if len(cache) > _PROCESSED_KEYS_MAX_PER_DEVICE:
                sorted_keys = sorted(cache, key=lambda k: k[1])
                _processed_scan_keys[device_id] = set(
                    sorted_keys[-_PROCESSED_KEYS_MAX_PER_DEVICE // 2:]
                )

            logger.info(
                "Ingestion for device %d: %d inserted, %d skipped (existing), "
                "%d filtered (duplicate taps), %d total logs",
                device_id,
                inserted,
                skipped,
                duplicates_filtered,
                total,
            )
            return summary
        except Exception:
            await self.db.rollback()
            raise

    async def _build_live_scan_events(
        self,
        scans: list[dict],
        device,
    ) -> list[dict]:
        """Build enriched event dicts for the live WebSocket broadcast.

        Includes ALL scans (IN, OUT, UNKNOWN, DUPLICATE) so the frontend
        live capture feed shows every fingerprint tap instantly.

        Each event gets a unique ``scan_id`` (UUID string) as its ``id``
        since DUPLICATE scans are not stored in the database and therefore
        have no DB primary key.
        """
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from school_service.models.student import Student
        from school_service.models.teacher import Teacher

        # Collect unique IDs
        student_ids = list({s["student_id"] for s in scans if s.get("student_id") is not None})
        teacher_ids = list({s["teacher_id"] for s in scans if s.get("teacher_id") is not None})

        # Batch-load student details
        student_info: dict[int, dict] = {}
        if student_ids:
            result = await self.db.execute(
                select(Student)
                .options(selectinload(Student.class_))
                .where(Student.id.in_(student_ids))
            )
            for s in result.scalars().all():
                class_name = s.class_.name if s.class_ else None
                student_info[s.id] = {
                    "student_name": f"{s.first_name} {s.last_name}",
                    "admission_number": s.admission_number,
                    "class_name": class_name,
                }

        teacher_info: dict[int, dict] = {}
        if teacher_ids:
            result = await self.db.execute(
                select(Teacher).where(Teacher.id.in_(teacher_ids))
            )
            for t in result.scalars().all():
                teacher_info[t.id] = {
                    "teacher_name": f"{t.first_name} {t.last_name}",
                    "employee_id": t.employee_id,
                }

        device_name = device.name if device else "Unknown"
        events = []
        for scan in scans:
            sid = scan.get("student_id")
            tid = scan.get("teacher_id")
            sinfo = student_info.get(sid, {}) if sid else {}
            tinfo = teacher_info.get(tid, {}) if tid else {}
            events.append({
                "id": scan["scan_id"],
                "student_id": sid,
                "student_name": sinfo.get("student_name"),
                "admission_number": sinfo.get("admission_number"),
                "teacher_id": tid,
                "teacher_name": tinfo.get("teacher_name"),
                "employee_id": tinfo.get("employee_id"),
                "class_name": sinfo.get("class_name"),
                "device_id": scan["device_id"],
                "device_name": device_name,
                "event_type": scan["event_type"],
                "occurred_at": scan["timestamp"],
            })
        return events
