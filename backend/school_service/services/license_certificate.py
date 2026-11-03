"""The licence certificate a school receives when the platform owner grants it a licence (A4 landscape PDF)."""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas

GREEN = colors.HexColor("#15803d")
INK = colors.black
MUTED = colors.HexColor("#374151")


def _d(day: date) -> str:
    return day.strftime("%d %B %Y")


def build_license_certificate(
    *,
    school_name: str,
    school_code: str,
    certificate_no: str,
    license_key: str,
    plan: str,
    starts_on: date,
    expires_on: date,
    issued_on: date,
    max_students: int | None = None,
    max_devices: int | None = None,
) -> bytes:
    buf = io.BytesIO()
    w, h = landscape(A4)
    c = Canvas(buf, pagesize=(w, h))
    c.setTitle(f"Licence certificate {certificate_no}")
    c.setAuthor("Shulepoa Attendance")

    # Border: a heavy green frame over a fine inner rule.
    c.setStrokeColor(GREEN)
    c.setLineWidth(5)
    c.rect(14 * mm, 14 * mm, w - 28 * mm, h - 28 * mm)
    c.setLineWidth(0.8)
    c.rect(19 * mm, 19 * mm, w - 38 * mm, h - 38 * mm)

    cx = w / 2
    # Mark
    c.setFillColor(GREEN)
    c.roundRect(cx - 9 * mm, h - 47 * mm, 18 * mm, 18 * mm, 3.5 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(cx, h - 43 * mm, "S")

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(cx, h - 55 * mm, "SHULEPOA ATTENDANCE")
    c.setFont("Times-Bold", 30)
    c.drawCentredString(cx, h - 70 * mm, "CERTIFICATE OF LICENCE")
    c.setStrokeColor(GREEN)
    c.setLineWidth(1.4)
    c.line(cx - 70 * mm, h - 75 * mm, cx + 70 * mm, h - 75 * mm)

    c.setFont("Times-Italic", 13)
    c.setFillColor(MUTED)
    c.drawCentredString(cx, h - 88 * mm, "This is to certify that")
    c.setFillColor(INK)
    size = 26
    while size > 14 and c.stringWidth(school_name.upper(), "Times-Bold", size) > w - 80 * mm:
        size -= 1
    c.setFont("Times-Bold", size)
    c.drawCentredString(cx, h - 101 * mm, school_name.upper())
    c.setFont("Helvetica", 10)
    c.setFillColor(MUTED)
    c.drawCentredString(cx, h - 108 * mm, f"School code {school_code}")
    c.setFont("Times-Italic", 13)
    c.drawCentredString(
        cx, h - 120 * mm,
        "is licensed to use the Shulepoa biometric attendance system for the period below.",
    )

    # Particulars, two columns
    rows = [
        ("Certificate no.", certificate_no, "Plan", plan.title()),
        ("Valid from", _d(starts_on), "Valid until", _d(expires_on)),
        ("Licence key", license_key, "Limits",
         " · ".join(x for x in (
             f"{max_students:,} learners" if max_students else None,
             f"{max_devices} devices" if max_devices else None,
         ) if x) or "Standard"),
    ]
    y = h - 137 * mm
    left_x, right_x = 52 * mm, cx + 12 * mm
    for l1, v1, l2, v2 in rows:
        for x, label, value in ((left_x, l1, v1), (right_x, l2, v2)):
            c.setFont("Helvetica", 9.5)
            c.setFillColor(MUTED)
            c.drawString(x, y, label)
            c.setFont("Helvetica-Bold", 11)
            c.setFillColor(INK)
            c.drawString(x + 32 * mm, y, value)
        y -= 9 * mm

    # Signature and date
    sy = 36 * mm
    c.setStrokeColor(INK)
    c.setLineWidth(0.6)
    c.line(52 * mm, sy, 122 * mm, sy)
    c.line(w - 122 * mm, sy, w - 52 * mm, sy)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(87 * mm, sy - 5 * mm, "FOR SHULEPOA ATTENDANCE")
    c.drawCentredString(w - 87 * mm, sy - 5 * mm, "DATE OF ISSUE")
    c.setFont("Helvetica", 11)
    c.drawCentredString(w - 87 * mm, sy + 2.5 * mm, _d(issued_on))

    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED)
    c.drawCentredString(cx, 24 * mm, f"Verify this certificate with Shulepoa quoting {certificate_no}.")
    c.showPage()
    c.save()
    return buf.getvalue()
