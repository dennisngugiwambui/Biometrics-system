"""PDF report generation: present today, date range, events (with school branding and signatures)."""

import io
import logging
from collections import defaultdict
from datetime import date
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from api_gateway.api.dependencies import get_current_user
from api_gateway.core.config import settings
from api_gateway.services.report_builder import build_report_pdf, build_report_pdf_class_sections
from shared.schemas.user import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])

# PDF column widths (mm) — prevents Date/Time + Device overlap
COL_STUD_SUMMARY_6 = [30.0, 20.0, 24.0, 34.0, 34.0, 32.0]  # Name, Adm, Class, IN, OUT, Device (wider times)
COL_STUD_SUMMARY_7 = [20.0, 28.0, 20.0, 24.0, 22.0, 22.0, 38.0]  # Date + above (no Class dup in section title)
COL_STUD_TIMELINE_6 = [28.0, 20.0, 24.0, 14.0, 30.0, 58.0]  # Name, Adm, Class, Event, DateTime, Device
COL_TEACHER_SUMMARY_5 = [36.0, 24.0, 28.0, 28.0, 58.0]
COL_TEACHER_TIMELINE_5 = [32.0, 22.0, 14.0, 30.0, 76.0]
COL_TEACHER_RANGE_6 = [20.0, 30.0, 24.0, 26.0, 26.0, 48.0]  # Date, Name, Emp ID, IN, OUT, Device


async def _get_school(auth: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{settings.SCHOOL_SERVICE_URL}/api/v1/schools/me",
            headers={"Authorization": auth},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to load school")
        return r.json()


async def _get_group_label(
    auth: str,
    class_id: Optional[int] = None,
    stream_id: Optional[int] = None,
) -> str:
    """Resolve class or stream name for report category."""
    if stream_id is not None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{settings.SCHOOL_SERVICE_URL}/api/v1/streams/{stream_id}",
                headers={"Authorization": auth},
            )
            if r.status_code == 200:
                data = r.json()
                name = data.get("name") or data.get("stream_name") or f"Stream {stream_id}"
                return f"Stream: {name}"
        return f"Stream ID {stream_id}"
    if class_id is not None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{settings.SCHOOL_SERVICE_URL}/api/v1/classes/{class_id}",
                headers={"Authorization": auth},
            )
            if r.status_code == 200:
                data = r.json()
                name = data.get("name") or data.get("class_name") or f"Class {class_id}"
                return f"Class: {name}"
        return f"Class ID {class_id}"
    return "Entire School"


ATTENDANCE_PAGE_SIZE = 200


def _group_student_records_by_class(items: list[dict]) -> list[tuple[str, list[dict]]]:
    buckets: dict[str, list[dict]] = {}
    for r in items:
        cls = (r.get("class_name") or "").strip() or "Unassigned"
        buckets.setdefault(cls, []).append(r)
    for cls in buckets:
        buckets[cls].sort(
            key=lambda x: (
                str(x.get("occurred_at") or ""),
                str(x.get("student_name") or x.get("admission_number") or ""),
            )
        )
    order = sorted(k for k in buckets if k != "Unassigned")
    if "Unassigned" in buckets:
        order.append("Unassigned")
    return [(k, buckets[k]) for k in order]


def _group_summary_rows_by_class(rows: list[list], class_col: int = 2) -> list[tuple[str, list[list]]]:
    buckets: dict[str, list[list]] = {}
    for row in rows:
        cls = (row[class_col] or "").strip() if class_col < len(row) else ""
        cls = cls or "Unassigned"
        buckets.setdefault(cls, []).append(row)
    order = sorted(k for k in buckets if k != "Unassigned")
    if "Unassigned" in buckets:
        order.append("Unassigned")
    return [(k, buckets[k]) for k in order]


def _fmt_pdf_ts(val) -> str:
    if not val:
        return "-"
    s = str(val).replace("T", " ")
    return s[:19] if len(s) >= 19 else s


def _prepare_items(
    items: list[dict],
    *,
    include_duplicates: bool,
    event_scope: Literal["all", "in", "out"],
) -> list[dict]:
    out: list[dict] = []
    for r in items:
        et = r.get("event_type")
        if not include_duplicates and et == "DUPLICATE":
            continue
        if event_scope == "in" and et != "IN":
            continue
        if event_scope == "out" and et != "OUT":
            continue
        out.append(r)
    return out


def _day_key_from_record(r: dict) -> str:
    o = r.get("occurred_at")
    if not o:
        return ""
    return str(o)[:10]


def _student_summary_rows_single_day(items: list[dict]) -> list[list]:
    """One row per student: Name, Adm, Class, first IN, last OUT, device."""
    buckets: dict[int, dict] = defaultdict(
        lambda: {
            "student_name": None,
            "admission_number": None,
            "class_name": None,
            "first_in": None,
            "last_out": None,
            "device": None,
        }
    )
    for r in items:
        if r.get("event_type") not in ("IN", "OUT"):
            continue
        sid = r.get("student_id")
        if sid is None:
            continue
        b = buckets[sid]
        b["student_name"] = r.get("student_name")
        b["admission_number"] = r.get("admission_number")
        b["class_name"] = r.get("class_name")
        ts = r.get("occurred_at")
        if r.get("event_type") == "IN":
            if b["first_in"] is None or str(ts) < str(b["first_in"]):
                b["first_in"] = ts
                b["device"] = r.get("device_name")
        else:
            if b["last_out"] is None or str(ts) > str(b["last_out"]):
                b["last_out"] = ts
                b["device"] = r.get("device_name")
    rows = []
    for sid in sorted(buckets.keys(), key=lambda x: (buckets[x].get("student_name") or "", x)):
        b = buckets[sid]
        rows.append(
            [
                b["student_name"] or "-",
                b["admission_number"] or "-",
                b["class_name"] or "-",
                _fmt_pdf_ts(b["first_in"]) if b["first_in"] else "-",
                _fmt_pdf_ts(b["last_out"]) if b["last_out"] else "-",
                b["device"] or "-",
            ]
        )
    return rows


def _student_summary_rows_multi_day(items: list[dict]) -> list[list]:
    """One row per student per day: Date, Name, Adm, Class, IN, OUT, Device."""
    buckets: dict[tuple[int, str], dict] = defaultdict(
        lambda: {
            "student_name": None,
            "admission_number": None,
            "class_name": None,
            "first_in": None,
            "last_out": None,
            "device": None,
        }
    )
    for r in items:
        if r.get("event_type") not in ("IN", "OUT"):
            continue
        sid = r.get("student_id")
        if sid is None:
            continue
        dk = _day_key_from_record(r)
        if not dk:
            continue
        k = (sid, dk)
        b = buckets[k]
        b["student_name"] = r.get("student_name")
        b["admission_number"] = r.get("admission_number")
        b["class_name"] = r.get("class_name")
        ts = r.get("occurred_at")
        if r.get("event_type") == "IN":
            if b["first_in"] is None or str(ts) < str(b["first_in"]):
                b["first_in"] = ts
                b["device"] = r.get("device_name")
        else:
            if b["last_out"] is None or str(ts) > str(b["last_out"]):
                b["last_out"] = ts
                b["device"] = r.get("device_name")
    rows = []
    for (sid, dk) in sorted(buckets.keys(), key=lambda x: (x[1], buckets[x].get("student_name") or "", x[0])):
        b = buckets[(sid, dk)]
        rows.append(
            [
                dk,
                b["student_name"] or "-",
                b["admission_number"] or "-",
                b["class_name"] or "-",
                _fmt_pdf_ts(b["first_in"]) if b["first_in"] else "-",
                _fmt_pdf_ts(b["last_out"]) if b["last_out"] else "-",
                b["device"] or "-",
            ]
        )
    return rows


def _teacher_summary_rows_single_day(items: list[dict]) -> list[list]:
    buckets: dict[int, dict] = defaultdict(
        lambda: {
            "teacher_name": None,
            "employee_id": None,
            "first_in": None,
            "last_out": None,
            "device": None,
        }
    )
    for r in items:
        if r.get("event_type") not in ("IN", "OUT"):
            continue
        tid = r.get("teacher_id")
        if tid is None:
            continue
        b = buckets[tid]
        b["teacher_name"] = r.get("teacher_name")
        b["employee_id"] = r.get("employee_id")
        ts = r.get("occurred_at")
        if r.get("event_type") == "IN":
            if b["first_in"] is None or str(ts) < str(b["first_in"]):
                b["first_in"] = ts
                b["device"] = r.get("device_name")
        else:
            if b["last_out"] is None or str(ts) > str(b["last_out"]):
                b["last_out"] = ts
                b["device"] = r.get("device_name")
    rows = []
    for tid in sorted(buckets.keys(), key=lambda x: (buckets[x].get("teacher_name") or "", x)):
        b = buckets[tid]
        rows.append(
            [
                b["teacher_name"] or "-",
                b["employee_id"] or "-",
                _fmt_pdf_ts(b["first_in"]) if b["first_in"] else "-",
                _fmt_pdf_ts(b["last_out"]) if b["last_out"] else "-",
                b["device"] or "-",
            ]
        )
    return rows


def _teacher_summary_rows_multi_day(items: list[dict]) -> list[list]:
    buckets: dict[tuple[int, str], dict] = defaultdict(
        lambda: {
            "teacher_name": None,
            "employee_id": None,
            "first_in": None,
            "last_out": None,
            "device": None,
        }
    )
    for r in items:
        if r.get("event_type") not in ("IN", "OUT"):
            continue
        tid = r.get("teacher_id")
        if tid is None:
            continue
        dk = _day_key_from_record(r)
        if not dk:
            continue
        k = (tid, dk)
        b = buckets[k]
        b["teacher_name"] = r.get("teacher_name")
        b["employee_id"] = r.get("employee_id")
        ts = r.get("occurred_at")
        if r.get("event_type") == "IN":
            if b["first_in"] is None or str(ts) < str(b["first_in"]):
                b["first_in"] = ts
                b["device"] = r.get("device_name")
        else:
            if b["last_out"] is None or str(ts) > str(b["last_out"]):
                b["last_out"] = ts
                b["device"] = r.get("device_name")
    rows = []
    for (tid, dk) in sorted(buckets.keys(), key=lambda x: (x[1], buckets[x].get("teacher_name") or "", x[0])):
        b = buckets[(tid, dk)]
        rows.append(
            [
                dk,
                b["teacher_name"] or "-",
                b["employee_id"] or "-",
                _fmt_pdf_ts(b["first_in"]) if b["first_in"] else "-",
                _fmt_pdf_ts(b["last_out"]) if b["last_out"] else "-",
                b["device"] or "-",
            ]
        )
    return rows


async def _get_attendance(
    auth: str,
    target_date: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    user_type: Optional[Literal["student", "teacher"]] = None,
    class_id: Optional[int] = None,
    stream_id: Optional[int] = None,
    event_type: Optional[str] = None,
) -> list[dict]:
    all_items: list[dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            params: dict = {"page": page, "page_size": ATTENDANCE_PAGE_SIZE}
            if user_type:
                params["user_type"] = user_type
            if target_date:
                params["target_date"] = target_date.isoformat()
            if date_from:
                params["date_from"] = date_from.isoformat()
            if date_to:
                params["date_to"] = date_to.isoformat()
            if class_id is not None:
                params["class_id"] = class_id
            if stream_id is not None:
                params["stream_id"] = stream_id
            if event_type:
                params["event_type"] = event_type
            r = await client.get(
                f"{settings.ATTENDANCE_SERVICE_URL}/api/v1/attendance",
                params=params,
                headers={"Authorization": auth},
            )
            if r.status_code != 200:
                try:
                    err_body = r.json()
                    detail_msg = err_body.get("detail", r.text or "Failed to load attendance")
                except Exception:
                    detail_msg = r.text or "Failed to load attendance"
                if isinstance(detail_msg, list):
                    detail_msg = "; ".join(str(x) for x in detail_msg)
                logger.warning("Attendance service returned %s: %s", r.status_code, detail_msg)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to load attendance: {detail_msg}",
                )
            data = r.json()
            items = data.get("items") or []
            all_items.extend(items)
            if len(items) < ATTENDANCE_PAGE_SIZE:
                break
            page += 1
    return all_items


@router.get(
    "/present-today",
    response_class=StreamingResponse,
    summary="Report: Present today (PDF)",
)
async def report_present_today(
    request: Request,
    user_type: Literal["student", "teacher"] = Query("student"),
    class_id: Optional[int] = Query(None, description="Student reports: filter by class"),
    stream_id: Optional[int] = Query(None, description="Student reports: filter by stream"),
    group_by_class: bool = Query(
        False,
        description="One PDF section per class (students only)",
    ),
    report_layout: Literal["summary", "timeline"] = Query(
        "summary",
        description="summary: one row per person with Time IN + Time OUT. timeline: every event row.",
    ),
    include_duplicates: bool = Query(
        False,
        description="Include DUPLICATE event rows (timeline only; not stored in DB normally)",
    ),
    current_user: UserResponse = Depends(get_current_user),
):
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")

    school = await _get_school(auth)
    raw = await _get_attendance(
        auth,
        target_date=date.today(),
        user_type=user_type,
        class_id=class_id,
        stream_id=stream_id,
    )
    items = _prepare_items(raw, include_duplicates=include_duplicates, event_scope="all")
    title = "DAILY ATTENDANCE SNAPSHOT"
    buf = io.BytesIO()
    group_label = await _get_group_label(auth, class_id=class_id, stream_id=stream_id)
    cat_bits = [report_layout, group_label]
    if group_by_class and user_type == "student":
        cat_bits.append("by class")
    metadata = {
        "date_from": date.today().isoformat(),
        "date_to": date.today().isoformat(),
        "year": str(date.today().year),
        "grade": "All Classes" if user_type == "student" else "All Departments",
        "category": "Today · " + " · ".join(cat_bits),
    }

    if user_type == "student":
        if report_layout == "summary":
            headers = ["Name", "Admission No", "Class", "Time (IN)", "Time (OUT)", "Device"]
            rows = _student_summary_rows_single_day(items)
            cw = COL_STUD_SUMMARY_6
            if group_by_class:
                sections = [(f"CLASS: {cn}", headers, grp) for cn, grp in _group_summary_rows_by_class(rows)]
                build_report_pdf_class_sections(
                    buf, title, school, sections, report_metadata=metadata, col_widths_mm=cw
                )
            else:
                build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=cw)
        else:
            headers = ["Name", "Admission No", "Class", "Event", "Date/Time", "Device"]

            def row_tl(r: dict) -> list:
                return [
                    r.get("student_name") or "-",
                    r.get("admission_number") or "-",
                    r.get("class_name") or "-",
                    r.get("event_type") or "-",
                    _fmt_pdf_ts(r.get("occurred_at")),
                    r.get("device_name") or "-",
                ]

            rows = [row_tl(r) for r in items]
            if group_by_class:
                sections = [
                    (f"CLASS: {cn}", headers, [row_tl(x) for x in grp])
                    for cn, grp in _group_student_records_by_class(items)
                ]
                build_report_pdf_class_sections(
                    buf, title, school, sections, report_metadata=metadata, col_widths_mm=COL_STUD_TIMELINE_6
                )
            else:
                build_report_pdf(
                    buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_STUD_TIMELINE_6
                )
    else:
        if report_layout == "summary":
            headers = ["Name", "Employee ID", "Time (IN)", "Time (OUT)", "Device"]
            rows = _teacher_summary_rows_single_day(items)
            build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_TEACHER_SUMMARY_5)
        else:
            headers = ["Name", "Employee ID", "Event", "Date/Time", "Device"]
            rows = [
                [
                    r.get("teacher_name") or "-",
                    r.get("employee_id") or "-",
                    r.get("event_type") or "-",
                    _fmt_pdf_ts(r.get("occurred_at")),
                    r.get("device_name") or "-",
                ]
                for r in items
            ]
            build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_TEACHER_TIMELINE_5)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="present-today-{user_type}s.pdf"'},
    )


@router.get(
    "/present-range",
    response_class=StreamingResponse,
    summary="Report: Present in date range (PDF)",
)
async def report_present_range(
    request: Request,
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    user_type: Literal["student", "teacher"] = Query("student"),
    class_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    group_by_class: bool = Query(False),
    report_layout: Literal["summary", "timeline"] = Query(
        "summary",
        description="summary: one row per student per day with IN/OUT. timeline: raw events.",
    ),
    include_duplicates: bool = Query(False),
    event_scope: Literal["all", "in", "out"] = Query(
        "all",
        description="timeline: only IN rows, only OUT rows, or all",
    ),
    current_user: UserResponse = Depends(get_current_user),
):
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")
    if date_from > date_to:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date_from must be <= date_to")

    school = await _get_school(auth)
    raw = await _get_attendance(
        auth,
        date_from=date_from,
        date_to=date_to,
        user_type=user_type,
        class_id=class_id,
        stream_id=stream_id,
    )
    items = _prepare_items(raw, include_duplicates=include_duplicates, event_scope=event_scope)
    category = await _get_group_label(auth, class_id=class_id, stream_id=stream_id)
    metadata = {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "date": date.today().strftime("%b %d, %Y"),
        "year": str(date_from.year),
        "category": f"{category} · {report_layout} · scope={event_scope}",
        "grade": f"{user_type.capitalize()}s",
    }
    title = "HISTORICAL ATTENDANCE REPORT"
    buf = io.BytesIO()

    if user_type == "student":
        if report_layout == "summary":
            headers = ["Date", "Name", "Admission No", "Class", "Time (IN)", "Time (OUT)", "Device"]
            rows = _student_summary_rows_multi_day(items)
            if group_by_class:
                sections = [(f"CLASS: {cn}", headers, grp) for cn, grp in _group_summary_rows_by_class(rows, 3)]
                build_report_pdf_class_sections(
                    buf, title, school, sections, report_metadata=metadata, col_widths_mm=COL_STUD_SUMMARY_7
                )
            else:
                build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_STUD_SUMMARY_7)
        else:
            headers = ["Name", "Admission No", "Class", "Event", "Date/Time", "Device"]

            def row_tl(r: dict) -> list:
                return [
                    r.get("student_name") or "-",
                    r.get("admission_number") or "-",
                    r.get("class_name") or "-",
                    r.get("event_type") or "-",
                    _fmt_pdf_ts(r.get("occurred_at")),
                    r.get("device_name") or "-",
                ]

            rows = [row_tl(r) for r in items]
            if group_by_class:
                sections = [
                    (f"CLASS: {cn}", headers, [row_tl(x) for x in grp])
                    for cn, grp in _group_student_records_by_class(items)
                ]
                build_report_pdf_class_sections(
                    buf, title, school, sections, report_metadata=metadata, col_widths_mm=COL_STUD_TIMELINE_6
                )
            else:
                build_report_pdf(
                    buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_STUD_TIMELINE_6
                )
    else:
        if report_layout == "summary":
            headers = ["Date", "Name", "Employee ID", "Time (IN)", "Time (OUT)", "Device"]
            rows = _teacher_summary_rows_multi_day(items)
            build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_TEACHER_RANGE_6)
        else:
            headers = ["Name", "Employee ID", "Event", "Date/Time", "Device"]
            rows = [
                [
                    r.get("teacher_name") or "-",
                    r.get("employee_id") or "-",
                    r.get("event_type") or "-",
                    _fmt_pdf_ts(r.get("occurred_at")),
                    r.get("device_name") or "-",
                ]
                for r in items
            ]
            build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_TEACHER_TIMELINE_5)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="present-range-{user_type}s.pdf"'},
    )


@router.get(
    "/events",
    response_class=StreamingResponse,
    summary="Report: Check-in/out events in period (PDF)",
)
async def report_events(
    request: Request,
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    user_type: Literal["student", "teacher"] = Query("student"),
    class_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    group_by_class: bool = Query(False),
    report_layout: Literal["summary", "timeline"] = Query(
        "timeline",
        description="timeline: each log line. summary: one row per person per day (IN/OUT).",
    ),
    include_duplicates: bool = Query(False),
    event_scope: Literal["all", "in", "out"] = Query("all"),
    current_user: UserResponse = Depends(get_current_user),
):
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")
    if date_from > date_to:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date_from must be <= date_to")

    school = await _get_school(auth)
    raw = await _get_attendance(
        auth,
        date_from=date_from,
        date_to=date_to,
        user_type=user_type,
        class_id=class_id,
        stream_id=stream_id,
    )
    items = _prepare_items(raw, include_duplicates=include_duplicates, event_scope=event_scope)
    category = await _get_group_label(auth, class_id=class_id, stream_id=stream_id)
    metadata = {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "date": date.today().strftime("%b %d, %Y"),
        "year": str(date_from.year),
        "category": f"{category} · Audit · {report_layout} · scope={event_scope}",
        "grade": f"{user_type.capitalize()} Log",
    }
    title = "STUDENT TIME-IN / TIME-OUT REPORT"
    buf = io.BytesIO()

    if user_type == "student":
        if report_layout == "summary":
            headers = ["Date", "Name", "Admission No", "Class", "Time (IN)", "Time (OUT)", "Device"]
            rows = _student_summary_rows_multi_day(items)
            if group_by_class:
                sections = [(f"CLASS: {cn}", headers, grp) for cn, grp in _group_summary_rows_by_class(rows, 3)]
                build_report_pdf_class_sections(
                    buf, title, school, sections, report_metadata=metadata, col_widths_mm=COL_STUD_SUMMARY_7
                )
            else:
                build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_STUD_SUMMARY_7)
        else:
            headers = ["Name", "Admission No", "Class", "Event", "Date/Time", "Device"]

            def row_ev(r: dict) -> list:
                return [
                    r.get("student_name") or "-",
                    r.get("admission_number") or "-",
                    r.get("class_name") or "-",
                    r.get("event_type") or "-",
                    _fmt_pdf_ts(r.get("occurred_at")),
                    r.get("device_name") or "-",
                ]

            rows = [row_ev(r) for r in items]
            if group_by_class:
                sections = [
                    (f"CLASS: {cn}", headers, [row_ev(x) for x in grp])
                    for cn, grp in _group_student_records_by_class(items)
                ]
                build_report_pdf_class_sections(
                    buf, title, school, sections, report_metadata=metadata, col_widths_mm=COL_STUD_TIMELINE_6
                )
            else:
                build_report_pdf(
                    buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_STUD_TIMELINE_6
                )
    else:
        if report_layout == "summary":
            headers = ["Date", "Name", "Employee ID", "Time (IN)", "Time (OUT)", "Device"]
            rows = _teacher_summary_rows_multi_day(items)
            build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_TEACHER_RANGE_6)
        else:
            headers = ["Name", "Employee ID", "Event", "Date/Time", "Device"]
            rows = [
                [
                    r.get("teacher_name") or "-",
                    r.get("employee_id") or "-",
                    r.get("event_type") or "-",
                    _fmt_pdf_ts(r.get("occurred_at")),
                    r.get("device_name") or "-",
                ]
                for r in items
            ]
            build_report_pdf(buf, title, school, rows, headers, report_metadata=metadata, col_widths_mm=COL_TEACHER_TIMELINE_5)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="events-{user_type}s.pdf"'},
    )
