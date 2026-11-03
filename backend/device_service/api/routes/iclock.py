"""ZKTeco push (ADMS) endpoints — terminals in cloud mode call these over plain HTTP
from any network. Protocol and reasoning: services/push_protocol.py.

Every reply is text/plain. Anything but "OK…" makes the device keep the data
and send it again later, which is what we want when we cannot store it.
"""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse

from device_service.core.database import AsyncSessionLocal
from device_service.services import push_protocol as P
from device_service.services.attendance_ingestion_service import AttendanceIngestionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/iclock", tags=["iclock"], include_in_schema=False)


def _text(body: str, status: int = 200) -> PlainTextResponse:
    return PlainTextResponse(body, status_code=status)


def _serial(req: Request) -> str:
    return str(req.query_params.get("SN") or req.query_params.get("sn") or "").strip()


def _client_ip(req: Request) -> str | None:
    fwd = req.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (req.client.host if req.client else None)


async def _device_for(db, req: Request, info: dict | None = None):
    """The registered device for this serial; unknown serials are remembered for the add-device form."""
    sn = _serial(req)
    if not sn:
        return sn, None
    device = await P.find_by_serial(db, sn)
    if not device:
        P.note_unclaimed(sn, _client_ip(req), info)
        return sn, None
    await P.touch(db, device, _client_ip(req), info)
    return sn, device


@router.get("/cdata")
async def cdata_get(req: Request):
    """First contact and every reconnect: hand over our settings."""
    try:
        async with AsyncSessionLocal() as db:
            pushver = req.query_params.get("pushver")
            sn, device = await _device_for(db, req, {"push_version": pushver} if pushver else None)
            if not sn:
                return _text("ERROR: no serial number", 400)
            if "options" in req.query_params or pushver:
                return _text(P.options_text(sn, device))
            return _text("OK")
    except Exception as e:  # noqa: BLE001
        logger.error("[iclock] cdata GET failed: %s", e, exc_info=True)
        return _text("ERROR", 500)


@router.post("/cdata")
async def cdata_post(req: Request):
    """Uploads: punches, user/fingerprint changes, device options."""
    try:
        body = (await req.body()).decode("utf-8", errors="replace")
        async with AsyncSessionLocal() as db:
            sn, device = await _device_for(db, req)
            if not sn:
                return _text("ERROR: no serial number", 400)
            # Not registered to a school yet: refuse, so the device keeps its data
            # and re-sends it once someone adds it.
            if not device:
                return _text("ERROR: device not registered")

            table = str(req.query_params.get("table") or "").upper()
            stamp = req.query_params.get("Stamp") or req.query_params.get("stamp") or req.query_params.get("OpStamp")

            if table == "ATTLOG":
                logs = P.parse_attlog(body)
                for log in logs:
                    log["device_serial"] = device.serial_number
                if logs:
                    summary = await AttendanceIngestionService(db).ingest_logs(device, logs)
                    logger.info("[iclock] %s uploaded %d punch(es), %d new", sn, len(logs), summary.inserted)
                if stamp:
                    device.push_att_stamp = str(stamp)[:40]
                    await db.commit()
                return _text(f"OK: {len(logs)}")
            if table == "OPERLOG":
                n = await P.absorb_user_records(db, device, body)
                if stamp:
                    device.push_op_stamp = str(stamp)[:40]
                    await db.commit()
                return _text(f"OK: {n}")
            if table in ("USERINFO", "USER"):
                return _text(f"OK: {await P.absorb_user_records(db, device, body, 'USER')}")
            if table in ("FINGERTMP", "BIODATA"):
                return _text(f"OK: {await P.absorb_user_records(db, device, body, 'FP')}")
            if table == "OPTIONS":
                await P.touch(db, device, _client_ip(req), P.parse_info_pairs([body]))
                return _text("OK")
            # Photos and anything else we don't keep: acknowledge so it isn't resent forever.
            return _text("OK")
    except Exception as e:  # noqa: BLE001
        logger.error("[iclock] cdata POST failed: %s", e, exc_info=True)
        return _text("ERROR", 500)


@router.get("/getrequest")
async def getrequest(req: Request):
    """The device asks for work every few seconds."""
    try:
        async with AsyncSessionLocal() as db:
            info = P.parse_info_param(req.query_params.get("INFO") or req.query_params.get("info"))
            _, device = await _device_for(db, req, info)
            if not device:
                return _text("OK")
            cmds = await P.take_commands(db, device)
            return _text("\n".join(cmds) + "\n" if cmds else "OK")
    except Exception as e:  # noqa: BLE001
        logger.error("[iclock] getrequest failed: %s", e, exc_info=True)
        return _text("OK")


@router.post("/devicecmd")
async def devicecmd(req: Request):
    """Outcomes of the commands it collected."""
    try:
        body = (await req.body()).decode("utf-8", errors="replace")
        async with AsyncSessionLocal() as db:
            _, device = await _device_for(db, req)
            if device:
                await P.record_results(db, device, body)
        return _text("OK")
    except Exception as e:  # noqa: BLE001
        logger.error("[iclock] devicecmd failed: %s", e, exc_info=True)
        return _text("OK")


# Newer (push 3.x) firmwares: register, then ask for settings and ping.
@router.post("/registry")
async def registry(req: Request):
    body = (await req.body()).decode("utf-8", errors="replace")
    async with AsyncSessionLocal() as db:
        sn, device = await _device_for(db, req, P.parse_info_pairs([body]))
    return _text(f"RegistryCode={sn}" if device else "OK")


@router.api_route("/push", methods=["GET", "POST"])
async def push(req: Request):
    async with AsyncSessionLocal() as db:
        sn, device = await _device_for(db, req)
    return _text(P.options_text(sn, device) if sn else "OK")


@router.api_route("/ping", methods=["GET", "POST"])
async def ping(req: Request):
    async with AsyncSessionLocal() as db:
        await _device_for(db, req)
    return _text("OK")


@router.post("/querydata")
async def querydata(req: Request):
    try:
        body = (await req.body()).decode("utf-8", errors="replace")
        tablename = str(req.query_params.get("tablename") or "user")
        async with AsyncSessionLocal() as db:
            _, device = await _device_for(db, req)
            if not device:
                return _text("OK")
            kind = "FP" if any(k in tablename.lower() for k in ("fp", "bio", "finger")) else "USER"
            n = await P.absorb_user_records(db, device, body, kind)
        return _text(f"{tablename}={n}")
    except Exception as e:  # noqa: BLE001
        logger.error("[iclock] querydata failed: %s", e, exc_info=True)
        return _text("OK")


@router.api_route("/{rest:path}", methods=["GET", "POST"])
async def anything_else(rest: str):
    return _text("OK")
