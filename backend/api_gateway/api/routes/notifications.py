"""Gateway notification routes: test SMS and weekly teacher reminders."""

import logging
from datetime import date, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from api_gateway.api.dependencies import get_current_user
from api_gateway.core.config import settings
from shared.schemas.user import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


def _last_n_weekdays(n: int = 5) -> tuple[date, date]:
    """Return (date_from, date_to) for the last n weekdays (excluding weekend)."""
    today = date.today()
    weekdays: list[date] = []
    d = today
    while len(weekdays) < n:
        if d.weekday() < 5:  # Mon=0 .. Fri=4
            weekdays.append(d)
        d -= timedelta(days=1)
    weekdays.sort()
    return weekdays[0], weekdays[-1]


def _render_template(template: str, **kwargs: str) -> str:
    """Replace {{key}} with values. Keys are case-sensitive."""
    out = template
    for k, v in kwargs.items():
        out = out.replace("{{" + k + "}}", str(v))
    return out


class TestSmsRequest(BaseModel):
    """Request to send a test message using school's configured provider and API key."""

    to: str = Field(..., description="Recipient phone number (e.g. +254712345678)")
    channel: Optional[str] = Field(
        None,
        description="Channel to test: sms, whatsapp, or both. Defaults to school's parent_delivery.",
    )


class TestSmsResponse(BaseModel):
    """Response after test SMS attempt."""

    success: bool
    detail: str


@router.post(
    "/test-sms",
    response_model=TestSmsResponse,
    summary="Send test SMS",
    description="Send a test SMS using the current school's notification settings (API key, sender ID).",
)
async def test_sms(
    body: TestSmsRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
) -> TestSmsResponse:
    """Send test SMS using school notification_settings; does not expose API key to client."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")

    async with httpx.AsyncClient(timeout=15.0) as client:
        school_resp = await client.get(
            f"{settings.SCHOOL_SERVICE_URL}/api/v1/schools/me",
            headers={"Authorization": auth},
        )
        if school_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to load school settings",
            )
        school = school_resp.json()
        ns = school.get("notification_settings") or {}
        api_key = (ns.get("api_key") or "").strip()
        parent_delivery = (ns.get("parent_delivery") or ns.get("channel") or "sms").strip().lower()
        # Normalize sandbox to bool (DB/JSON may have true/false or string "true"/"false")
        _sandbox_raw = ns.get("sandbox", True)
        sandbox_bool = (
            bool(_sandbox_raw)
            if isinstance(_sandbox_raw, bool)
            else (str(_sandbox_raw).strip().lower() not in ("0", "false", "no", ""))
        )
        username_val = ns.get("username")
        if isinstance(username_val, str):
            username_val = username_val.strip() or None
        channels_to_test: list[str] = []
        if body.channel and body.channel.strip().lower() in ("sms", "whatsapp", "both"):
            ch = body.channel.strip().lower()
            if ch == "both":
                channels_to_test = ["sms", "whatsapp"]
            else:
                channels_to_test = [ch]
        else:
            channels_to_test = ["both"] if parent_delivery == "both" else [parent_delivery]

        message = "Test from School Biometric System. Your notifications are set up correctly."
        results: list[str] = []
        for ch in channels_to_test:
            if ch == "sms" and not api_key:
                results.append("SMS: skipped (no API key)")
                continue
            if ch == "whatsapp":
                wa_id = (ns.get("whatsapp_phone_number_id") or "").strip()
                if not wa_id:
                    results.append("WhatsApp: skipped (no phone number ID)")
                    continue
                wa_key = (ns.get("whatsapp_api_key") or api_key or "").strip()
                if not wa_key:
                    results.append("WhatsApp: skipped (no API key)")
                    continue
            send_body = {
                "to": body.to.strip(),
                "message": message,
                "provider": ns.get("provider") or "africas_talking",
                "api_key": api_key if ch == "sms" else (ns.get("whatsapp_api_key") or api_key or ""),
                "username": username_val,
                "sender_id": ns.get("sender_id"),
                "channel": ch,
                "whatsapp_phone_number_id": ns.get("whatsapp_phone_number_id"),
                "sandbox": sandbox_bool,
            }
            send_resp = await client.post(
                f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/send-message",
                json=send_body,
            )
            try:
                data = send_resp.json() if send_resp.content else {}
            except Exception:
                data = {}
            if send_resp.status_code in (200, 201) and data.get("success") is True:
                results.append(f"{ch.upper()}: Sent")
            else:
                detail = data.get("detail", send_resp.text or "Send failed")
                if not detail and send_resp.status_code != 200:
                    detail = f"HTTP {send_resp.status_code}"
                results.append(f"{ch.upper()}: {str(detail)[:200]}")
        if not results:
            return TestSmsResponse(
                success=False,
                detail="Configure at least one channel (SMS API key or WhatsApp) in Settings → Notifications.",
            )
        success = all("Sent" in r for r in results)
        return TestSmsResponse(success=success, detail="; ".join(results))


class SendWeeklyRemindersResponse(BaseModel):
    """Response after sending weekly reminders to teachers."""

    sent: int
    failed: int
    detail: str


@router.post(
    "/send-weekly-reminders",
    response_model=SendWeeklyRemindersResponse,
    summary="Send weekly attendance reminders to teachers",
    description="For each teacher, compute present days in the last 5 weekdays and send SMS using the teacher_weekly_reminder template.",
)
async def send_weekly_reminders(
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
) -> SendWeeklyRemindersResponse:
    """Send weekly reminder SMS to all teachers (present X/5 days, percentage)."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Get school (notification_settings)
        school_resp = await client.get(
            f"{settings.SCHOOL_SERVICE_URL}/api/v1/schools/me",
            headers={"Authorization": auth},
        )
        if school_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to load school")
        school = school_resp.json()
        ns = school.get("notification_settings") or {}
        api_key = (ns.get("api_key") or "").strip()
        if not api_key:
            return SendWeeklyRemindersResponse(
                sent=0,
                failed=0,
                detail="Configure API key in Settings → Notifications first.",
            )
        templates = ns.get("templates") or {}
        tpl = (templates.get("teacher_weekly_reminder") or "Dear {{teacher_name}}, Your attendance summary for the week: {{present_days}}/{{total_days}} days ({{percentage}}%). - {{school_name}}").strip()
        school_name = school.get("name") or "School"

        # 2. Get all teachers (school service allows page_size up to 200; paginate to get all)
        teachers: list[dict] = []
        page = 1
        page_size = 200
        while True:
            teachers_resp = await client.get(
                f"{settings.SCHOOL_SERVICE_URL}/api/v1/teachers",
                params={"page": page, "page_size": page_size},
                headers={"Authorization": auth},
            )
            if teachers_resp.status_code != 200:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to load teachers")
            teachers_data = teachers_resp.json()
            items = teachers_data.get("items") or []
            teachers.extend(items)
            if len(items) < page_size:
                break
            page += 1

        date_from, date_to = _last_n_weekdays(5)
        sent = 0
        failed = 0

        for t in teachers:
            teacher_id = t.get("id")
            phone = (t.get("phone") or "").strip()
            if not phone:
                continue
            first = t.get("first_name") or ""
            last = t.get("last_name") or ""
            teacher_name = f"{first} {last}".strip() or "Teacher"

            # 3. Get attendance for this teacher in the last 5 weekdays
            att_resp = await client.get(
                f"{settings.ATTENDANCE_SERVICE_URL}/api/v1/attendance",
                params={
                    "teacher_id": teacher_id,
                    "date_from": date_from.isoformat(),
                    "date_to": date_to.isoformat(),
                    "page_size": 100,
                },
                headers={"Authorization": auth},
            )
            present_days = 0
            if att_resp.status_code == 200:
                att_data = att_resp.json()
                items = att_data.get("items") or []
                dates_with_in = set()
                for rec in items:
                    if rec.get("event_type") == "IN":
                        ot = rec.get("occurred_at") or ""
                        if ot:
                            try:
                                d = ot[:10]
                                dates_with_in.add(d)
                            except Exception:
                                pass
                present_days = len(dates_with_in)
            total_days = 5
            percentage = round(100 * present_days / total_days) if total_days else 0

            message = _render_template(
                tpl,
                teacher_name=teacher_name,
                present_days=str(present_days),
                total_days=str(total_days),
                percentage=str(percentage),
                school_name=school_name,
            )

            channel = (ns.get("channel") or "sms").strip().lower()
            send_body = {
                "to": phone,
                "message": message,
                "provider": ns.get("provider") or "africas_talking",
                "api_key": api_key,
                "username": ns.get("username"),
                "sender_id": ns.get("sender_id"),
                "channel": channel,
                "whatsapp_phone_number_id": ns.get("whatsapp_phone_number_id"),
                "sandbox": ns.get("sandbox", True),
            }
            send_resp = await client.post(
                f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/send-message",
                json=send_body,
            )
            if send_resp.status_code in (200, 201):
                sent += 1
            else:
                failed += 1
                logger.warning("Weekly reminder send failed for teacher %s: %s", teacher_id, send_resp.text)

        return SendWeeklyRemindersResponse(
            sent=sent,
            failed=failed,
            detail=f"Sent {sent} reminders, {failed} failed.",
        )


class AttendanceEventPayload(BaseModel):
    """Single attendance event for parent notification."""

    school_id: int
    student_id: Optional[int] = None
    teacher_id: Optional[int] = None
    event_type: str = "IN"
    occurred_at: str = ""


class TriggerAttendanceRequest(BaseModel):
    """Request to send parent SMS for attendance events (e.g. student check-in/out)."""

    events: list[AttendanceEventPayload] = Field(default_factory=list)


class TriggerAttendanceResponse(BaseModel):
    """Result of trigger attendance notifications."""

    sent: int
    failed: int
    detail: str


@router.post(
    "/trigger-attendance",
    response_model=TriggerAttendanceResponse,
    summary="Send parent SMS for attendance events",
    description="For each event with student_id, send SMS to parent using school templates. Uses current user's school.",
)
async def trigger_attendance_notifications(
    request: Request,
    body: TriggerAttendanceRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> TriggerAttendanceResponse:
    """Send parent notification SMS for given attendance events (student check-in/out)."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")
    if not body.events:
        return TriggerAttendanceResponse(sent=0, failed=0, detail="No events to process.")

    async with httpx.AsyncClient(timeout=30.0) as client:
        school_resp = await client.get(
            f"{settings.SCHOOL_SERVICE_URL}/api/v1/schools/me",
            headers={"Authorization": auth},
        )
        if school_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to load school")
        school = school_resp.json()
        if school.get("id") != current_user.school_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="School mismatch")
        ns = school.get("notification_settings") or {}
        api_key = (ns.get("api_key") or "").strip()
        parent_delivery = (ns.get("parent_delivery") or ns.get("channel") or "sms").strip().lower()
        has_sms = bool(api_key) and parent_delivery in ("sms", "both")
        has_wa = (
            bool((ns.get("whatsapp_phone_number_id") or "").strip())
            and bool((ns.get("whatsapp_api_key") or api_key or "").strip())
            and parent_delivery in ("whatsapp", "both")
        )
        if not has_sms and not has_wa:
            return TriggerAttendanceResponse(
                sent=0, failed=len(body.events),
                detail="Configure SMS API key and/or WhatsApp in Settings → Notifications.",
            )
        templates = ns.get("templates") or {}
        school_name = school.get("name") or "School"
        sent = 0
        failed = 0
        for ev in body.events:
            if ev.student_id is None:
                continue
            try:
                student_resp = await client.get(
                    f"{settings.SCHOOL_SERVICE_URL}/api/v1/students/{ev.student_id}",
                    headers={"Authorization": auth},
                )
                if student_resp.status_code != 200:
                    failed += 1
                    continue
                student = student_resp.json()
                parent_phone = (student.get("parent_phone") or "").strip()
                if not parent_phone:
                    failed += 1
                    continue
                student_name = f"{student.get('first_name') or ''} {student.get('last_name') or ''}".strip() or "Student"
                event_type = (ev.event_type or "IN").upper()
                time_str = (ev.occurred_at or "")[:19]
                date_str = (ev.occurred_at or "")[:10] if ev.occurred_at else ""
                if event_type == "IN":
                    tpl = (templates.get("student_checkin") or "Dear parent, {{student_name}} has checked in at {{time}} on {{date}}. - {{school_name}}").strip()
                else:
                    tpl = (templates.get("student_checkout") or "Dear parent, {{student_name}} has checked out at {{time}} on {{date}}. - {{school_name}}").strip()
                message = _render_template(
                    tpl,
                    student_name=student_name,
                    time=time_str,
                    date=date_str,
                    event=event_type,
                    school_name=school_name,
                )
                channels = ["sms", "whatsapp"] if parent_delivery == "both" else [parent_delivery]
                for ch in channels:
                    if ch == "whatsapp" and not (ns.get("whatsapp_phone_number_id") or "").strip():
                        continue
                    api_key_use = (ns.get("whatsapp_api_key") or api_key or "").strip() if ch == "whatsapp" else api_key
                    if not api_key_use:
                        continue
                    send_body = {
                        "to": parent_phone,
                        "message": message,
                        "provider": ns.get("provider") or "africas_talking",
                        "api_key": api_key_use,
                        "username": ns.get("username"),
                        "sender_id": ns.get("sender_id"),
                        "channel": ch,
                        "whatsapp_phone_number_id": ns.get("whatsapp_phone_number_id"),
                        "sandbox": ns.get("sandbox", True),
                    }
                    send_resp = await client.post(
                        f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/send-message",
                        json=send_body,
                    )
                    if send_resp.status_code in (200, 201):
                        sent += 1
                    else:
                        failed += 1
            except Exception:
                failed += 1
        return TriggerAttendanceResponse(
            sent=sent,
            failed=failed,
            detail=f"Sent {sent} parent notification(s), {failed} failed.",
        )


# ---------------------------------------------------------------------------
# Internal trigger (called by device service after saving attendance)
# ---------------------------------------------------------------------------

class TriggerAttendanceInternalRequest(BaseModel):
    """Request body for internal trigger (no user auth)."""

    school_id: int = Field(..., description="School ID")
    events: list[AttendanceEventPayload] = Field(default_factory=list)


@router.post(
    "/trigger-attendance-internal",
    response_model=TriggerAttendanceResponse,
    summary="[Internal] Send parent notifications for attendance events",
    description="Called by device service after saving attendance. Requires X-Internal-Key header.",
)
async def trigger_attendance_internal(
    request: Request,
    body: TriggerAttendanceInternalRequest,
    x_internal_key: Optional[str] = None,
) -> TriggerAttendanceResponse:
    """Send parent SMS/WhatsApp for given events. Uses INTERNAL_API_KEY for school/student lookup."""
    key = (x_internal_key or request.headers.get("X-Internal-Key") or "").strip()
    if not settings.NOTIFICATION_INTERNAL_KEY or key != settings.NOTIFICATION_INTERNAL_KEY.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing internal key")
    if not body.events:
        return TriggerAttendanceResponse(sent=0, failed=0, detail="No events to process.")

    internal_headers = {"X-Internal-Key": key}
    async with httpx.AsyncClient(timeout=30.0) as client:
        school_resp = await client.get(
            f"{settings.SCHOOL_SERVICE_URL}/api/v1/internal/schools/{body.school_id}",
            headers=internal_headers,
        )
        if school_resp.status_code != 200:
            logger.warning("Internal trigger: failed to load school %s: %s", body.school_id, school_resp.status_code)
            return TriggerAttendanceResponse(sent=0, failed=len(body.events), detail="Failed to load school.")
        school = school_resp.json()
        ns = school.get("notification_settings") or {}
        api_key = (ns.get("api_key") or "").strip()
        parent_delivery = (ns.get("parent_delivery") or ns.get("channel") or "sms").strip().lower()
        has_sms = bool(api_key) and parent_delivery in ("sms", "both")
        has_wa = (
            bool((ns.get("whatsapp_phone_number_id") or "").strip())
            and bool((ns.get("whatsapp_api_key") or api_key or "").strip())
            and parent_delivery in ("whatsapp", "both")
        )
        if not has_sms and not has_wa:
            return TriggerAttendanceResponse(
                sent=0, failed=len(body.events),
                detail="School has no notification API key or WhatsApp config for the selected delivery.",
            )
        templates = ns.get("templates") or {}
        school_name = school.get("name") or "School"
        sent = 0
        failed = 0
        for ev in body.events:
            if ev.student_id is None:
                continue
            try:
                student_resp = await client.get(
                    f"{settings.SCHOOL_SERVICE_URL}/api/v1/internal/students/{ev.student_id}",
                    headers=internal_headers,
                )
                if student_resp.status_code != 200:
                    failed += 1
                    continue
                student = student_resp.json()
                parent_phone = (student.get("parent_phone") or "").strip()
                if not parent_phone:
                    failed += 1
                    continue
                student_name = f"{student.get('first_name') or ''} {student.get('last_name') or ''}".strip() or "Student"
                event_type = (ev.event_type or "IN").upper()
                time_str = (ev.occurred_at or "")[:19]
                date_str = (ev.occurred_at or "")[:10] if ev.occurred_at else ""
                if event_type == "IN":
                    tpl = (templates.get("student_checkin") or "Dear parent, {{student_name}} has checked in at {{time}} on {{date}}. - {{school_name}}").strip()
                else:
                    tpl = (templates.get("student_checkout") or "Dear parent, {{student_name}} has checked out at {{time}} on {{date}}. - {{school_name}}").strip()
                message = _render_template(
                    tpl,
                    student_name=student_name,
                    time=time_str,
                    date=date_str,
                    event=event_type,
                    school_name=school_name,
                )
                channels = ["sms", "whatsapp"] if parent_delivery == "both" else [parent_delivery]
                for ch in channels:
                    if ch == "whatsapp" and not (ns.get("whatsapp_phone_number_id") or "").strip():
                        continue
                    api_key_use = (ns.get("whatsapp_api_key") or api_key or "").strip() if ch == "whatsapp" else api_key
                    if not api_key_use:
                        continue
                    send_body = {
                        "to": parent_phone,
                        "message": message,
                        "provider": ns.get("provider") or "africas_talking",
                        "api_key": api_key_use,
                        "username": ns.get("username"),
                        "sender_id": ns.get("sender_id"),
                        "channel": ch,
                        "whatsapp_phone_number_id": ns.get("whatsapp_phone_number_id"),
                        "sandbox": ns.get("sandbox", True),
                    }
                    send_resp = await client.post(
                        f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/send-message",
                        json=send_body,
                    )
                    if send_resp.status_code in (200, 201):
                        sent += 1
                    else:
                        failed += 1
            except Exception as e:
                logger.warning("Internal trigger send failed for student %s: %s", ev.student_id, e)
                failed += 1
        return TriggerAttendanceResponse(
            sent=sent,
            failed=failed,
            detail=f"Sent {sent} parent notification(s), {failed} failed.",
        )
