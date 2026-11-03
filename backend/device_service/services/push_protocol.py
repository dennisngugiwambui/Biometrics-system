"""Cloud ("push" / ADMS) connection for ZKTeco terminals.

A server on the internet cannot open a connection to a terminal behind a school
router — 192.168.x.x only exists inside that building. So in cloud mode the
TERMINAL calls US, from whatever network it is on, using ZKTeco's push protocol
over plain HTTP (same design as School-ERP's services/biometricPush.js):

  GET  /iclock/cdata?SN=…&options=all   first contact → our settings
  POST /iclock/cdata?SN=…&table=ATTLOG  punches, the moment they happen
  POST /iclock/cdata?SN=…&table=OPERLOG users / fingerprints changed on it
  GET  /iclock/getrequest?SN=…          every few seconds → queued commands
  POST /iclock/devicecmd?SN=…           the outcome of each command

The device is matched by serial number. Commands for it wait in
device_push_commands until its next check-in; callers that need the answer
poll that row. PushDeviceConnection (cloud_connection.py) wraps this in the
same interface as ZKDeviceConnection, so enrollment, sync and health checks
work for both kinds of device.
"""

import asyncio
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import parse_qs

import pytz
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from device_service.core.config import settings
from device_service.core.database import AsyncSessionLocal
from device_service.models.device import Device, DeviceStatus
from device_service.models.push_command import DevicePushCommand

logger = logging.getLogger(__name__)

# How often the terminal asks for commands (seconds) — low enough that an
# enrolment starts within a few seconds of the click.
DELAY_S = max(2, int(os.getenv("BIOMETRIC_PUSH_DELAY", "4") or 4))
# A device that has not called in for this long is offline.
ONLINE_S = max(60, DELAY_S * 6)
BATCH = 20
QUEUE_TTL = timedelta(days=7)


def device_tz_hours() -> float:
    tz = pytz.timezone(settings.ATTENDANCE_TIMEZONE)
    off = tz.utcoffset(datetime.now()) or timedelta(0)
    return off.total_seconds() / 3600


def norm_serial(s: Any) -> str:
    return str(s or "").strip().upper()


def is_cloud(device: Optional[Device]) -> bool:
    return bool(device) and getattr(device, "connection_mode", "direct") == "cloud"


def is_online(device: Device) -> bool:
    t = device.push_last_seen_at
    return bool(t) and (datetime.now(timezone.utc) - t).total_seconds() < ONLINE_S


def ago_text(t: datetime) -> str:
    s = int((datetime.now(timezone.utc) - t).total_seconds())
    if s < 90:
        return f"{s} seconds ago"
    if s < 5400:
        return f"{round(s / 60)} minutes ago"
    if s < 129600:
        return f"{round(s / 3600)} hours ago"
    return f"{round(s / 86400)} days ago"


def offline_error(device: Device) -> str:
    if not device.push_last_seen_at:
        host = settings.PUBLIC_HOST or "this system's address"
        return (
            f"{device.name} hasn't connected yet. On the device open Menu → Comm → Cloud Server Setting, "
            f"enter {host} with port 80, and check that the serial number here "
            f"({device.serial_number or 'not set'}) matches the one under System Info."
        )
    return f"{device.name} is offline — it last connected {ago_text(device.push_last_seen_at)}. Check it is powered on and has internet."


# ── Serial → device ─────────────────────────────────────────────────────────
async def find_by_serial(db: AsyncSession, sn: str) -> Optional[Device]:
    serial = norm_serial(sn)
    if not serial:
        return None
    rows = (await db.execute(
        select(Device)
        .where(func.upper(func.trim(Device.serial_number)) == serial, Device.is_deleted.is_(False))
        .order_by(Device.updated_at.desc().nullslast())
    )).scalars().all()
    if len(rows) > 1:
        logger.warning("[push] serial %s registered %d times — using device %s", serial, len(rows), rows[0].id)
    return rows[0] if rows else None


# Terminals calling in with a serial nobody registered yet — offered on the
# add-device form. In memory on purpose: an unclaimed device calls again in seconds.
_unclaimed: dict[str, dict] = {}


def note_unclaimed(serial: str, ip: Optional[str], info: Optional[dict]) -> None:
    s = norm_serial(serial)
    if not s:
        return
    prev = _unclaimed.get(s)
    now = datetime.now(timezone.utc)
    _unclaimed[s] = {"serial": s, "ip": ip, "first_seen": prev["first_seen"] if prev else now, "last_seen": now,
                     "info": info or (prev or {}).get("info")}
    if len(_unclaimed) > 500:
        _unclaimed.pop(next(iter(_unclaimed)))


def list_unclaimed(viewer_ip: Optional[str] = None) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    out = [d for d in _unclaimed.values() if d["last_seen"] > cutoff]
    out.sort(key=lambda d: d["last_seen"], reverse=True)
    return [{"serial": d["serial"], "last_seen": d["last_seen"].isoformat(),
             "firmware": (d.get("info") or {}).get("firmware"),
             "same_network": bool(viewer_ip) and d["ip"] == viewer_ip} for d in out]


def forget_unclaimed(serial: str) -> None:
    _unclaimed.pop(norm_serial(serial), None)


# ── Check-ins ───────────────────────────────────────────────────────────────
def parse_info_param(s: Optional[str]) -> Optional[dict]:
    """'Ver 6.60 Apr 2 2019,2,2,10,192.168.1.201,10,…' — counts some firmwares send with getrequest."""
    if not s:
        return None
    p = str(s).split(",")

    def n(i: int):
        try:
            return int(p[i]) if i < len(p) and p[i] != "" else None
        except ValueError:
            return None

    return {"firmware": p[0] or None, "users": n(1), "fingers": n(2), "records": n(3),
            "lan_ip": p[4] if len(p) > 4 and p[4] else None}


INFO_KEYS = {
    "~devicename": "device_name", "devicename": "device_name", "mac": "mac", "~platform": "platform",
    "~zkfpversion": "fp_version", "zkfpversion": "fp_version", "fwversion": "firmware", "~serialnumber": "serial",
    "ipaddress": "lan_ip", "usercount": "users", "fpcount": "fingers", "transactioncount": "records",
    "maxusercount": "users_cap", "maxfingercount": "fingers_cap", "maxattlogcount": "records_cap",
}


def parse_info_pairs(lines: list[str]) -> dict:
    info: dict = {}
    for part in re.split(r"[\n,\t]", "\n".join(lines)):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        key = INFO_KEYS.get(k.strip().lower())
        if not key:
            continue
        v = v.strip()
        info[key] = int(v) if key in ("users", "fingers", "records", "users_cap", "fingers_cap") and v.isdigit() else v
    if str(info.get("records_cap", "")).isdigit():
        c = int(info["records_cap"])
        info["records_cap"] = c * 10000 if 0 < c < 1000 else c  # most firmwares report tens of thousands
    return info


_last_touch: dict[int, float] = {}


async def touch(db: AsyncSession, device: Device, ip: Optional[str], info: Optional[dict] = None) -> None:
    """Record that the device called (throttled), and switch it to cloud mode if it was direct."""
    now = time.time()
    changed = False
    if now - _last_touch.get(device.id, 0) > 15 or not is_online(device):
        device.push_last_seen_at = datetime.now(timezone.utc)
        device.last_seen = device.push_last_seen_at
        device.status = DeviceStatus.ONLINE
        changed = True
    if ip and device.push_remote_ip != ip:
        device.push_remote_ip = ip
        changed = True
    if device.connection_mode != "cloud":
        device.connection_mode = "cloud"
        changed = True
    if info:
        clean = {k: v for k, v in info.items() if v is not None}
        device.push_info = {**(device.push_info or {}), **clean, "updated_at": datetime.now(timezone.utc).isoformat()}
        if isinstance(clean.get("users_cap"), int):
            device.max_users = clean["users_cap"]
        if isinstance(clean.get("users"), int):
            device.enrolled_users = clean["users"]
        changed = True
    if changed:
        _last_touch[device.id] = now
        await db.commit()


def options_text(serial: str, device: Optional[Device]) -> str:
    return "\n".join([
        f"GET OPTION FROM: {serial}",
        f"ATTLOGStamp={(device.push_att_stamp if device else None) or 0}",
        f"OPERLOGStamp={(device.push_op_stamp if device else None) or 0}",
        "ATTPHOTOStamp=None",
        "ErrorDelay=30",
        f"Delay={DELAY_S}",
        "TransTimes=00:00;14:05",
        "TransInterval=1",
        "TransFlag=TransData AttLog\tOpLog\tEnrollUser\tChgUser\tEnrollFP\tChgFP",
        f"TimeZone={device_tz_hours():g}",
        "Realtime=1",
        "Encrypt=None",
        "ServerVer=2.4.1",
        "PushProtVer=2.4.1",
    ]) + "\n"


# ── Uploaded data ───────────────────────────────────────────────────────────
def parse_device_time(s: str) -> Optional[datetime]:
    """Device clock text is the school's wall time."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):?(\d{2})?", str(s or "").strip())
    if not m:
        return None
    y, mo, d, h, mi, se = (int(x) if x else 0 for x in m.groups())
    try:
        return pytz.timezone(settings.ATTENDANCE_TIMEZONE).localize(datetime(y, mo, d, h, mi, se))
    except ValueError:
        return None


def parse_attlog(body: str) -> list[dict]:
    """ATTLOG lines: PIN \\t time \\t status \\t verify \\t workcode … → the shape get_attendance_logs returns."""
    out = []
    for line in str(body).splitlines():
        f = line.split("\t")
        if len(f) < 2 or not f[0].strip():
            continue
        ts = parse_device_time(f[1])
        if not ts:
            continue
        punch = int(f[2]) if len(f) > 2 and f[2].strip().lstrip("-").isdigit() else None
        out.append({"user_id": f[0].strip(), "timestamp": ts, "punch": punch, "device_serial": None})
    return out


def parse_kv(line: str) -> tuple[Optional[str], dict]:
    """'USER PIN=1\\tName=Amina' / 'PIN=1\\tFID=0…' / 'FP PIN=…' → (type, {lowercased key: value})."""
    rest, typ = line, None
    m = re.match(r"^([A-Za-z_]+)\s+(.*)$", line)
    if m and "=" not in m.group(1):
        typ, rest = m.group(1).upper(), m.group(2)
    kv = {}
    for part in rest.split("\t"):
        if "=" in part:
            k, v = part.split("=", 1)
            kv[k.strip().lower()] = v.strip()
    return typ, kv


def clean_card(c: Any) -> Optional[str]:
    s = re.sub(r"[\[\]\s]", "", str(c or ""))
    return s if s and s != "0" else None


async def absorb_user_records(db: AsyncSession, device: Device, body: str, default_type: Optional[str] = None) -> int:
    """Fold USER / FP records into the device's user mirror (push_users)."""
    users = dict(device.push_users or {})
    n, changed = 0, False
    for line in str(body).splitlines():
        if not line.strip():
            continue
        n += 1
        typ, kv = parse_kv(line)
        t = typ or default_type
        pin = kv.get("pin")
        if not pin:
            continue
        if t in ("USER", "USERINFO"):
            prev = users.get(pin, {})
            users[pin] = {**prev, "name": kv.get("name", prev.get("name", "")),
                          "card": clean_card(kv.get("card", kv.get("cardno"))) or prev.get("card"),
                          "role": int(kv.get("pri", kv.get("privilege", prev.get("role", 0))) or 0)}
            changed = True
        elif t in ("FP", "FINGERTMP", "BIODATA"):
            u = dict(users.get(pin) or {"name": "", "card": None, "role": 0})
            fid = str(kv.get("fid", kv.get("no", "0")))
            u["fingers"] = sorted(set((u.get("fingers") or []) + [fid]))
            users[pin] = u
            changed = True
    if changed:
        device.push_users = users
        await db.commit()
    return n


# ── Commands ────────────────────────────────────────────────────────────────
async def queue(db: AsyncSession, device: Device, command: str, *, kind: Optional[str] = None, ttl: timedelta = timedelta(minutes=2)) -> DevicePushCommand:
    row = DevicePushCommand(device_id=device.id, school_id=device.school_id, command=command, kind=kind,
                            status="pending", expires_at=datetime.now(timezone.utc) + ttl)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def take_commands(db: AsyncSession, device: Device) -> list[str]:
    rows = (await db.execute(
        select(DevicePushCommand)
        .where(DevicePushCommand.device_id == device.id, DevicePushCommand.status == "pending",
               DevicePushCommand.expires_at > datetime.now(timezone.utc))
        .order_by(DevicePushCommand.id).limit(BATCH)
    )).scalars().all()
    if not rows:
        return []
    await db.execute(update(DevicePushCommand).where(DevicePushCommand.id.in_([r.id for r in rows]))
                     .values(status="sent", sent_at=datetime.now(timezone.utc)))
    await db.commit()
    return [f"C:{r.id}:{r.command}" for r in rows]


def parse_cmd_results(body: str) -> list[dict]:
    """'ID=12&Return=0&CMD=DATA' lines, each optionally followed by extra lines (INFO answers)."""
    out: list[dict] = []
    for line in str(body).splitlines():
        if re.match(r"^ID=", line, re.I):
            q = parse_qs(line.replace("\t", "&"))
            try:
                out.append({"id": int(q.get("ID", ["x"])[0]), "ret": int(q.get("Return", ["-999"])[0]),
                            "cmd": q.get("CMD", [""])[0], "extra": []})
            except ValueError:
                continue
        elif line.strip() and out:
            out[-1]["extra"].append(line.strip())
    return out


async def record_results(db: AsyncSession, device: Device, body: str) -> int:
    results = parse_cmd_results(body)
    for r in results:
        row = await db.get(DevicePushCommand, r["id"])
        if not row or row.device_id != device.id:
            continue
        ok = r["ret"] == 0 if row.kind == "enroll" else r["ret"] >= 0
        result = "\n".join(r["extra"])[:20000] if r["extra"] else None
        # Very old firmwares only know "DATA USER": retry once that way before failing a user sync.
        if not ok and row.kind == "user" and row.command.startswith("DATA UPDATE USERINFO "):
            legacy = await queue(db, device, row.command.replace("DATA UPDATE USERINFO ", "DATA USER ", 1), kind="user-legacy", ttl=QUEUE_TTL)
            result = f"retry:{legacy.id}"
        row.status = "done" if ok else "failed"
        row.return_code = r["ret"]
        row.result = result
        row.done_at = datetime.now(timezone.utc)
        if ok and row.kind == "info" and r["extra"]:
            device.push_info = {**(device.push_info or {}), **parse_info_pairs(r["extra"]),
                                "updated_at": datetime.now(timezone.utc).isoformat()}
        if ok and row.kind == "clear-users":
            device.push_users = {}
        if ok and row.kind in ("user", "user-legacy"):
            _, kv = parse_kv(re.sub(r"^DATA (UPDATE USERINFO|USER) ", "USER ", row.command))
            if kv.get("pin"):
                users = dict(device.push_users or {})
                users[kv["pin"]] = {**users.get(kv["pin"], {}), "name": kv.get("name", ""),
                                    "card": clean_card(kv.get("card")), "role": int(kv.get("pri", 0) or 0)}
                device.push_users = users
        if ok and row.kind == "delete-user":
            _, kv = parse_kv(row.command.replace("DATA DELETE USERINFO ", "USER ", 1))
            if kv.get("pin"):
                users = dict(device.push_users or {})
                users.pop(kv["pin"], None)
                device.push_users = users
        if ok and row.kind == "delete-finger":
            _, kv = parse_kv(row.command.replace("DATA DELETE FINGERTMP ", "FP ", 1))
            pin, fid = kv.get("pin"), kv.get("fid")
            users = dict(device.push_users or {})
            if pin in users:
                u = dict(users[pin])
                u["fingers"] = [f for f in (u.get("fingers") or []) if f != fid]
                users[pin] = u
                device.push_users = users
        await db.commit()
    return len(results)


async def wait_for(command_id: int, timeout_s: float, on_sent=None, *, expire: bool = True) -> Optional[DevicePushCommand]:
    """Poll a command row (in a fresh session each time) until it finishes or time runs out."""
    until = time.time() + timeout_s
    sent_seen = False
    while time.time() < until:
        async with AsyncSessionLocal() as db:
            row = await db.get(DevicePushCommand, command_id)
            if not row:
                return None
            if row.status == "sent" and not sent_seen:
                sent_seen = True
                if on_sent:
                    await on_sent(row)
            if row.status == "failed" and re.match(r"^retry:\d+$", row.result or ""):
                return await wait_for(int(row.result[6:]), until - time.time(), on_sent, expire=expire)
            if row.status in ("done", "failed", "expired"):
                return row
        await asyncio.sleep(0.8)
    async with AsyncSessionLocal() as db:
        row = await db.get(DevicePushCommand, command_id)
        if expire and row and row.status == "pending":
            row.status = "expired"
            await db.commit()
        return row


RETURN_TEXT = {
    -1: "the device didn't accept the command's settings",
    -2: "the device could not save it",
    -3: "the device is busy or its memory is full",
    -1002: "this device's firmware doesn't support that command",
}


def failure_text(device: Device, row: Optional[DevicePushCommand]) -> str:
    if not row:
        return "The command was lost — try again."
    if row.status in ("expired", "pending"):
        return f"{device.name} didn't collect the command in time. " + ("It may be busy — try again." if is_online(device) else offline_error(device))
    if row.status == "sent":
        return f"{device.name} took the command but hasn't answered yet — check its screen, then try again."
    return f"{device.name} refused the command — {RETURN_TEXT.get(row.return_code, f'device code {row.return_code}')}."


def tabless(s: Any) -> str:
    return re.sub(r"[\t\r\n]", " ", str(s if s is not None else ""))


def user_command(*, user_id: str, name: str = "", card: int = 0, privilege: int = 0, password: str = "") -> str:
    return (f"DATA UPDATE USERINFO PIN={tabless(user_id)}\tName={tabless(name)[:24]}\tPri={14 if privilege == 14 else 0}"
            f"\tPasswd={tabless(password)}\tCard={int(card) if card else ''}\tGrp=1\tTZ=0000000000000000\tVerify=0")
