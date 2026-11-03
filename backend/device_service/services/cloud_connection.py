"""PushDeviceConnection — a cloud (push/ADMS) device behind the ZKDeviceConnection interface.

DeviceConnectionService.get_connection() returns one of these for a device in
cloud mode, so enrollment, user sync, health checks and the device pages keep
working whether the terminal is on the server's network (direct, TCP 4370) or
anywhere on the internet (it calls us; see push_protocol.py).

Punches never need reading from a cloud device — they arrive by upload the
moment they happen — so get_attendance_logs() is always empty.
"""

import base64
import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict, List, Optional

from device_service.core.database import AsyncSessionLocal
from device_service.models.device import Device
from device_service.services import push_protocol as P
from device_service.zk.enrollment import EnrollmentEvent, EnrollmentProgress

logger = logging.getLogger(__name__)


@dataclass
class PushUser:
    """Same attributes the code reads from pyzk's User."""
    uid: int
    user_id: str
    name: str = ""
    privilege: int = 0
    card: int = 0
    password: str = ""
    group_id: str = ""


class PushDeviceConnection:
    def __init__(self, device: Device):
        self.device_id = device.id
        self.name = device.name
        self.ip = device.push_remote_ip or "cloud"
        self.port = 80
        self._enroll_cmd_id: Optional[int] = None

    # ── plumbing ───────────────────────────────────────────────────────────
    async def _device(self, db) -> Device:
        d = await db.get(Device, self.device_id)
        if d is None:
            raise RuntimeError("Device not found")
        return d

    async def _run(self, command: str, *, kind: str, timeout_s: float = 45, require_online: bool = True) -> tuple[bool, str]:
        async with AsyncSessionLocal() as db:
            d = await self._device(db)
            if require_online and not P.is_online(d):
                return False, P.offline_error(d)
            row = await P.queue(db, d, command, kind=kind, ttl=timedelta(seconds=timeout_s))
            row_id = row.id
        done = await P.wait_for(row_id, timeout_s)
        if done and done.status == "done":
            return True, done.result or ""
        async with AsyncSessionLocal() as db:
            return False, P.failure_text(await self._device(db), done)

    # ── connection ─────────────────────────────────────────────────────────
    @property
    def is_connected(self) -> bool:
        return True  # nothing to hold open; each call checks the device is calling in

    async def connect(self) -> bool:
        return await self.test_connection()

    async def disconnect(self):
        return None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def test_connection(self) -> bool:
        async with AsyncSessionLocal() as db:
            return P.is_online(await self._device(db))

    # ── info ───────────────────────────────────────────────────────────────
    async def _info(self) -> dict:
        async with AsyncSessionLocal() as db:
            d = await self._device(db)
            return dict(d.push_info or {}) | {"serial": d.serial_number}

    async def get_serial_number(self) -> Optional[str]:
        return (await self._info()).get("serial")

    async def get_device_name(self) -> Optional[str]:
        return (await self._info()).get("device_name")

    async def get_firmware_version(self) -> Optional[str]:
        return (await self._info()).get("firmware")

    async def get_time(self) -> Optional[str]:
        # Cloud devices take their clock from this server on every connect.
        return None

    async def get_free_sizes(self) -> Optional[Dict[str, int]]:
        # Counts arrive with check-ins; ask for the full profile (capacities) as well.
        await self._run("INFO", kind="info", timeout_s=10)
        i = await self._info()
        if i.get("users") is None and i.get("users_cap") is None:
            return None
        users, fingers, records = i.get("users") or 0, i.get("fingers") or 0, i.get("records") or 0
        users_cap, fingers_cap, rec_cap = i.get("users_cap") or 0, i.get("fingers_cap") or 0, i.get("records_cap") or 0
        return {
            "users": users, "fingers": fingers, "records": records, "cards": 0, "faces": 0,
            "users_cap": users_cap, "fingers_cap": fingers_cap, "rec_cap": rec_cap, "faces_cap": 0,
            "users_av": max(0, users_cap - users), "fingers_av": max(0, fingers_cap - fingers),
            "rec_av": max(0, rec_cap - records),
        }

    # ── users ──────────────────────────────────────────────────────────────
    async def get_users(self, *, strict: bool = False) -> list:
        """Ask the device to upload its user list, then read the mirror it builds."""
        ok, err = await self._run("DATA QUERY USERINFO", kind="query-users", timeout_s=40)
        async with AsyncSessionLocal() as db:
            d = await self._device(db)
            mirror = d.push_users or {}
        if not ok and not mirror:
            if strict:
                raise RuntimeError(err)
            return []
        out = []
        for pin, u in mirror.items():
            card = u.get("card")
            out.append(PushUser(uid=int(pin) if str(pin).isdigit() else 0, user_id=str(pin), name=u.get("name") or "",
                                privilege=int(u.get("role") or 0), card=int(card) if str(card or "").isdigit() else 0))
        return out

    async def _mirror_has(self, pin: str) -> bool:
        async with AsyncSessionLocal() as db:
            return str(pin) in ((await self._device(db)).push_users or {})

    async def student_on_device(self, student_id: int) -> bool:
        return await self._mirror_has(str(student_id))

    async def teacher_on_device(self, teacher_id: int) -> bool:
        return await self._mirror_has(f"T{teacher_id}")

    async def admin_on_device(self, admin_user_id: int) -> bool:
        return await self._mirror_has(f"A{admin_user_id}")

    async def set_user(self, uid: int, name: str, user_id: str, privilege: int = 0, password: str = "",
                       group_id: str = "", card: int = 0) -> bool:
        """Applied straight away when the device is online; otherwise queued for its next check-in."""
        cmd = P.user_command(user_id=user_id, name=name, card=card, privilege=privilege, password=password)
        async with AsyncSessionLocal() as db:
            d = await self._device(db)
            online = P.is_online(d)
            row = await P.queue(db, d, cmd, kind="user", ttl=P.QUEUE_TTL)
            row_id = row.id
        if not online:
            return True
        done = await P.wait_for(row_id, 30, expire=False)
        if done and done.status in ("done", "pending", "sent"):
            return True
        async with AsyncSessionLocal() as db:
            raise RuntimeError(P.failure_text(await self._device(db), done))

    async def delete_user_from_device(self, uid: int, user_id: str = "") -> None:
        pin = user_id or str(uid)
        ok, err = await self._run(f"DATA DELETE USERINFO PIN={P.tabless(pin)}", kind="delete-user")
        if not ok:
            raise RuntimeError(err)

    async def delete_all_users_on_device(self) -> int:
        async with AsyncSessionLocal() as db:
            n = len((await self._device(db)).push_users or {})
        ok, err = await self._run("CLEAR DATA", kind="clear-users")
        if not ok:
            raise RuntimeError(err)
        return n

    async def clear_all_data_on_device(self) -> None:
        ok, err = await self._run("CLEAR DATA", kind="clear-users")
        if not ok:
            raise RuntimeError(err)

    async def clear_attendance_on_device(self) -> None:
        ok, err = await self._run("CLEAR LOG", kind="clear-log")
        if not ok:
            raise RuntimeError(err)

    async def restart_device(self) -> None:
        ok, err = await self._run("REBOOT", kind="reboot", timeout_s=30)
        if not ok:
            raise RuntimeError(err)

    # ── fingerprints ───────────────────────────────────────────────────────
    async def get_enrolled_finger_ids(self, user_id: str) -> list[int]:
        async with AsyncSessionLocal() as db:
            u = ((await self._device(db)).push_users or {}).get(str(user_id)) or {}
        return sorted(int(f) for f in (u.get("fingers") or []) if str(f).isdigit())

    async def finger_is_enrolled(self, user_id: str, finger_id: int) -> bool:
        return finger_id in await self.get_enrolled_finger_ids(user_id)

    async def get_template_bytes(self, user_id: str, finger_id: int) -> Optional[bytes]:
        # Templates stay on the terminal in cloud mode.
        return None

    async def set_user_template(self, user_id: str, finger_id: int, template_bytes: bytes, uid: Optional[int] = None) -> bool:
        tmp = base64.b64encode(template_bytes).decode()
        ok, err = await self._run(
            f"DATA UPDATE FINGERTMP PIN={P.tabless(user_id)}\tFID={int(finger_id)}\tSize={len(tmp)}\tValid=1\tTMP={tmp}",
            kind="template", timeout_s=40)
        if not ok:
            raise RuntimeError(err)
        return True

    async def delete_user_template(self, user_id: str, finger_id: int, uid: Optional[int] = None) -> bool:
        ok, err = await self._run(f"DATA DELETE FINGERTMP PIN={P.tabless(user_id)}\tFID={int(finger_id)}", kind="delete-finger")
        if not ok:
            raise RuntimeError(err)
        return True

    async def delete_all_fingerprint_templates_on_device(self) -> int:
        # The push protocol has no "templates only" clear; remove them user by user.
        async with AsyncSessionLocal() as db:
            mirror = (await self._device(db)).push_users or {}
        n = 0
        for pin, u in mirror.items():
            for fid in u.get("fingers") or []:
                try:
                    await self.delete_user_template(pin, int(fid))
                    n += 1
                except RuntimeError as e:
                    logger.warning("[push] could not delete finger %s/%s: %s", pin, fid, e)
        return n

    async def enroll_user_async(self, user_id: str, finger_id: int = 0, uid: int = 0, progress_callback=None,
                                timeout: int = 60, max_attempts: int = 3):
        """The terminal runs the presses itself after ENROLL_FP, then answers once."""
        async def emit(event: EnrollmentEvent, attempt: int, message: str):
            if progress_callback:
                await progress_callback(EnrollmentProgress(event=event, attempt=attempt, total_attempts=max_attempts, message=message))

        async with AsyncSessionLocal() as db:
            d = await self._device(db)
            if not P.is_online(d):
                await emit(EnrollmentEvent.FAILED, 0, P.offline_error(d))
                return False
            row = await P.queue(db, d, f"ENROLL_FP PIN={P.tabless(user_id)}\tFID={int(finger_id)}\tRETRY={max_attempts}\tOVERWRITE=1",
                                kind="enroll", ttl=timedelta(seconds=30))
            self._enroll_cmd_id = row.id
        await emit(EnrollmentEvent.STARTED, 0, "Sending the enrolment to the device…")

        async def on_sent(_row):
            await emit(EnrollmentEvent.WAITING_FINGER, 1, f"Place the finger on the device — press it {max_attempts} times as the screen asks.")

        done = await P.wait_for(row.id, max(timeout, 60) + 90, on_sent)
        self._enroll_cmd_id = None
        if done and done.status == "done":
            await emit(EnrollmentEvent.COMPLETED, max_attempts, "Fingerprint enrolled.")
            return True
        if done and done.status == "failed":
            why = {4: (EnrollmentEvent.CANCELLED, "Cancelled on the device."),
                   5: (EnrollmentEvent.DUPLICATE_FINGER, "This finger is already enrolled."),
                   6: (EnrollmentEvent.TIMEOUT, "Timed out waiting for the finger — try again.")}.get(done.return_code)
            if why:
                await emit(why[0], 0, why[1])
                return False
        async with AsyncSessionLocal() as db:
            await emit(EnrollmentEvent.FAILED, 0, P.failure_text(await self._device(db), done))
        return False

    async def cancel_enrollment(self) -> bool:
        # A queued ENROLL_FP not yet collected can be withdrawn; one the device is
        # already running ends on the device's own screen.
        if not self._enroll_cmd_id:
            return True
        from device_service.models.push_command import DevicePushCommand  # noqa: WPS433
        async with AsyncSessionLocal() as db:
            row = await db.get(DevicePushCommand, self._enroll_cmd_id)
            if row and row.status == "pending":
                row.status = "expired"
                await db.commit()
        return True

    # ── attendance ─────────────────────────────────────────────────────────
    async def get_attendance_logs(self) -> List[Dict[str, Any]]:
        return []  # punches arrive by upload (POST /iclock/cdata?table=ATTLOG)
