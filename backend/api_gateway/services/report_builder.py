"""Build attendance PDF reports on the school's official stationery.

The layout follows the School ERP's registry documents (backend/src/services/
pdf/official.js and punchReport.js there), so a report from this system and one
from portal.shulepoa.co.ke look like they came from the same office:

  • the crest on the left, the school name centred in serif capitals, one
    contact line, the issuing office, then a heavy rule over a hairline
  • a centred title with the period under it
  • the particulars (scope, period, counts) between two rules
  • ruled black-on-white tables with a bold header row that repeats on every
    page, and a running head (school name) on pages after the first
  • a sign-off block (Name / Signature / Date) and a footer on every page:
    school · reference, print time, "Page x of y"

Black ink on white paper, nothing else: these get photocopied and filed.
"""

import base64
import io
import re
from datetime import datetime
from typing import Any, Optional
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

INK = colors.black
MUTED = colors.HexColor("#222222")
FAINT = colors.HexColor("#444444")

PAGE = landscape(A4)
MARGIN = 13 * mm
WIDTH = PAGE[0] - 2 * MARGIN

_S = {
    "school": ParagraphStyle("school", fontName="Times-Bold", fontSize=18, leading=21, alignment=TA_CENTER, textColor=INK),
    "motto": ParagraphStyle("motto", fontName="Times-Italic", fontSize=8.8, leading=11, alignment=TA_CENTER, textColor=MUTED),
    "contact": ParagraphStyle("contact", fontName="Helvetica", fontSize=8.2, leading=11, alignment=TA_CENTER, textColor=MUTED),
    "office": ParagraphStyle("office", fontName="Helvetica-Bold", fontSize=8.6, leading=11, alignment=TA_CENTER, textColor=INK),
    "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=13, leading=16, alignment=TA_CENTER, textColor=INK),
    "subtitle": ParagraphStyle("subtitle", fontName="Helvetica-Bold", fontSize=9.6, leading=13, alignment=TA_CENTER, textColor=INK),
    "note": ParagraphStyle("note", fontName="Helvetica", fontSize=8.6, leading=11, alignment=TA_CENTER, textColor=MUTED),
    "label": ParagraphStyle("label", fontName="Helvetica", fontSize=8.2, leading=10, textColor=INK),
    "value": ParagraphStyle("value", fontName="Helvetica-Bold", fontSize=8.6, leading=10, textColor=INK),
    "section": ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=9.4, leading=12, textColor=INK),
    "th": ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=8, leading=9.6, textColor=INK),
    "td": ParagraphStyle("td", fontName="Helvetica", fontSize=8, leading=9.6, textColor=INK),
    "td_b": ParagraphStyle("td_b", fontName="Helvetica-Bold", fontSize=8, leading=9.6, textColor=INK),
    "td_c": ParagraphStyle("td_c", fontName="Helvetica", fontSize=8, leading=9.6, textColor=INK, alignment=TA_CENTER),
    "empty": ParagraphStyle("empty", fontName="Helvetica-Oblique", fontSize=8.4, leading=11, textColor=FAINT),
    "sig_head": ParagraphStyle("sig_head", fontName="Helvetica-Bold", fontSize=7.6, leading=9, textColor=INK),
    "sig_line": ParagraphStyle("sig_line", fontName="Helvetica", fontSize=7.8, leading=9, textColor=INK),
}

# Column headers that print bold (the figures a reader looks for first) and centred.
_TIME_HEADS = {"time (in)", "time (out)", "time in", "time out", "check-in", "check-out"}


# ── Branding ────────────────────────────────────────────────────────────────
def _logo_reader(school: dict[str, Any]) -> Optional[ImageReader]:
    url = (school.get("branding") or {}).get("logoDataUrl")
    if not url or not url.startswith("data:"):
        return None
    m = re.match(r"data:image/[^;]+;base64,(.+)", url)
    if not m:
        return None
    try:
        return ImageReader(io.BytesIO(base64.b64decode(m.group(1))))
    except Exception:
        return None


def _contact_line(school: dict[str, Any]) -> str:
    parts = [
        f"P.O. Box {school['po_box']}" if school.get("po_box") else None,
        school.get("address") or None,
        f"Tel: {school['phone']}" if school.get("phone") else None,
        f"Email: {school['email']}" if school.get("email") else None,
    ]
    return "   ·   ".join(p for p in parts if p)


def _monogram(canvas, name: str, cx: float, cy: float, r: float) -> None:
    initials = "".join(w[0] for w in re.findall(r"[A-Za-z]\w*", name or "S")[:2]).upper() or "S"
    canvas.saveState()
    canvas.setStrokeColor(INK)
    canvas.setLineWidth(1.2)
    canvas.circle(cx, cy, r)
    canvas.setLineWidth(0.5)
    canvas.circle(cx, cy, r - 2.6)
    canvas.setFont("Times-Bold", r * 0.86)
    canvas.setFillColor(INK)
    canvas.drawCentredString(cx, cy - r * 0.3, initials)
    canvas.restoreState()


# ── Page furniture ──────────────────────────────────────────────────────────
class _Stationery:
    """Draws the letterhead on page 1, the running head after it, and the footer."""

    LOGO = 58  # pt, the crest's square on the letterhead

    def __init__(self, school: dict[str, Any], office: str, ref: str):
        self.school = school
        self.name = str(school.get("name") or "School")
        self.office = office
        self.ref = ref
        self.logo = _logo_reader(school)
        self.printed = datetime.now().strftime("%d %b %Y, %H:%M")

    def letterhead_height(self) -> float:
        # Name 22 + contact 12 + office 13, never less than the crest; then the rule.
        lines = 22 + (12 if _contact_line(self.school) else 0) + (13 if self.office else 0)
        return max(self.LOGO, lines) + 6 + 14

    def first_page(self, canvas, doc) -> None:
        canvas.saveState()
        top = PAGE[1] - MARGIN
        gutter = self.LOGO + 12  # kept clear on both sides so the text stays centred
        tx, tw = MARGIN + gutter, WIDTH - 2 * gutter
        y = top
        for text, style in (
            (self.name.upper(), _S["school"]),
            (_contact_line(self.school), _S["contact"]),
            ((self.office or "").upper(), _S["office"]),
        ):
            if not text:
                continue
            p = Paragraph(xml_escape(text), style)
            _, h = p.wrap(tw, 100)
            p.drawOn(canvas, tx, y - h)
            y -= h + 1
        block = max(self.LOGO, top - y)
        ly = top - (block + self.LOGO) / 2
        if self.logo:
            canvas.drawImage(self.logo, MARGIN, ly, self.LOGO, self.LOGO, preserveAspectRatio=True, anchor="c", mask="auto")
        else:
            _monogram(canvas, self.name, MARGIN + self.LOGO / 2, ly + self.LOGO / 2, self.LOGO / 2)
        ry = top - block - 6
        canvas.setStrokeColor(INK)
        canvas.setLineWidth(1.6)
        canvas.line(MARGIN, ry, MARGIN + WIDTH, ry)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, ry - 3, MARGIN + WIDTH, ry - 3)
        canvas.restoreState()
        self.footer(canvas, doc)

    def later_page(self, canvas, doc) -> None:
        canvas.saveState()
        top = PAGE[1] - MARGIN
        if self.logo:
            canvas.drawImage(self.logo, MARGIN, top - 18, 18, 18, preserveAspectRatio=True, anchor="c", mask="auto")
        canvas.setFont("Times-Bold", 10.5)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(PAGE[0] / 2, top - 13, self.name.upper())
        canvas.setStrokeColor(INK)
        canvas.setLineWidth(0.6)
        canvas.line(MARGIN, top - 21, MARGIN + WIDTH, top - 21)
        canvas.restoreState()
        self.footer(canvas, doc)

    def footer(self, canvas, doc) -> None:
        # "Page x of y" needs the total, so the text is placed by _NumberedCanvas;
        # this only draws the rule.
        canvas.saveState()
        fy = MARGIN - 2
        canvas.setStrokeColor(INK)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, fy + 8, MARGIN + WIDTH, fy + 8)
        canvas.restoreState()


def _numbered_canvas(stationery: _Stationery):
    from reportlab.pdfgen.canvas import Canvas

    class _NumberedCanvas(Canvas):
        """Holds every page until the end so the footer can say "Page x of y"."""

        def __init__(self, *a, **kw):
            super().__init__(*a, **kw)
            self._pages: list[dict] = []

        def showPage(self):
            self._pages.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._pages)
            for i, state in enumerate(self._pages, 1):
                self.__dict__.update(state)
                fy = MARGIN - 2
                self.setFillColor(FAINT)
                self.setFont("Helvetica", 6.8)
                self.drawString(MARGIN, fy, f"{stationery.name}  ·  {stationery.ref}")
                self.drawCentredString(PAGE[0] / 2, fy, f"Printed {stationery.printed}")
                self.setFont("Helvetica-Bold", 6.8)
                self.setFillColor(MUTED)
                self.drawRightString(MARGIN + WIDTH, fy, f"Page {i} of {total}")
                super().showPage()
            super().save()

    return _NumberedCanvas


# ── Body pieces ─────────────────────────────────────────────────────────────
def _title_block(title: str, subtitle: Optional[str], note: Optional[str]) -> list:
    out: list = [Paragraph(xml_escape(title.upper()), _S["title"])]
    if subtitle:
        out.append(Paragraph(xml_escape(subtitle.upper()), _S["subtitle"]))
    if note:
        out.append(Paragraph(xml_escape(note), _S["note"]))
    out.append(Spacer(1, 3 * mm))
    return out


def _particulars(pairs: list[tuple[str, str]], columns: int = 4) -> Table:
    """ "Label: value" in columns between two rules, the way a registry form sets it."""
    cells, row = [], []
    for label, value in pairs:
        row.append(
            Paragraph(
                f'<font name="Helvetica" size="8.2">{xml_escape(label)}:</font>&nbsp;&nbsp;'
                f'<font name="Helvetica-Bold" size="8.6">{xml_escape(value or "—")}</font>',
                _S["label"],
            )
        )
        if len(row) == columns:
            cells.append(row)
            row = []
    if row:
        cells.append(row + [""] * (columns - len(row)))
    t = Table(cells, colWidths=[WIDTH / columns] * columns)
    t.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 0), (-1, 0), 0.8, INK),
                ("LINEBELOW", (0, -1), (-1, -1), 0.8, INK),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return t


def _section_heading(text: str, note: Optional[str] = None) -> list:
    t = Table([[Paragraph(xml_escape(text.upper()), _S["section"])]], colWidths=[WIDTH])
    t.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.6, INK),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    out: list = [t]
    if note:
        out.append(Paragraph(xml_escape(note), ParagraphStyle("sn", parent=_S["td"], textColor=MUTED, fontSize=7.8)))
    out.append(Spacer(1, 2 * mm))
    return out


def _col_widths(headers: list[str], col_widths_mm: Optional[list[float]]) -> list[float]:
    """Callers size columns for portrait A4 (174mm); scale them to this page and add the # column."""
    n = len(headers)
    num_w = 9 * mm
    avail = WIDTH - num_w
    if col_widths_mm and len(col_widths_mm) == n:
        total = sum(col_widths_mm)
        widths = [w / total * avail for w in col_widths_mm]
    else:
        widths = [avail / n] * n
    return [num_w] + widths


def _ruled_table(headers: list[str], rows: list[list[Any]], col_widths_mm: Optional[list[float]]) -> Table:
    time_cols = {i for i, h in enumerate(headers) if h.strip().lower() in _TIME_HEADS}
    head = [Paragraph("#", _S["th"])] + [Paragraph(xml_escape(h.upper()), _S["th"]) for h in headers]
    body = []
    for n, row in enumerate(rows, 1):
        cells: list[Any] = [Paragraph(str(n), _S["td_c"])]
        for i, v in enumerate(row):
            text = "—" if v in (None, "", "-") else str(v)
            style = _S["td_b"] if i in time_cols and text != "—" else _S["td"]
            cells.append(Paragraph(xml_escape(text), style))
        body.append(cells)
    t = Table([head] + body, colWidths=_col_widths(headers, col_widths_mm), repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, INK),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, INK),
                ("LINEBELOW", (0, 0), (-1, 0), 1.2, INK),  # the header row: bold type, heavier rule
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def _sign_off(signatories: list[str]) -> KeepTogether:
    cols = []
    for label in signatories:
        dots = "." * 58
        cols.append(
            [
                Paragraph(xml_escape(label.upper()), _S["sig_head"]),
                Spacer(1, 6),
                Paragraph(f"Name: {dots}", _S["sig_line"]),
                Spacer(1, 7),
                Paragraph(f"Signature: {dots[:-6]}", _S["sig_line"]),
                Spacer(1, 7),
                Paragraph(f"Date: {dots[:-1]}", _S["sig_line"]),
            ]
        )
    w = min(WIDTH / max(1, len(cols)) - 10, 100 * mm)
    t = Table([cols], colWidths=[w + 10] * len(cols), hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    return KeepTogether([Spacer(1, 10 * mm), t])


# ── Document ────────────────────────────────────────────────────────────────
def _office_for(title: str) -> str:
    t = title.lower()
    if "teacher" in t or "staff" in t:
        return "Office of the Principal · Human Resources"
    return "Office of the Deputy Principal"


def _particulars_for(meta: dict[str, Any], record_count: int) -> list[tuple[str, str]]:
    df, dt = meta.get("date_from"), meta.get("date_to")
    period = _date_label(df) if df and df == dt else (f"{_date_label(df)} – {_date_label(dt)}" if df and dt else "—")
    return [
        ("Scope", meta.get("scope") or meta.get("category") or "Entire school"),
        ("Period", period),
        ("Records", f"{record_count:,}"),
        ("Reference", meta.get("ref_no") or "—"),
    ]


def _date_label(iso: Optional[str]) -> str:
    if not iso:
        return "—"
    try:
        return datetime.strptime(str(iso)[:10], "%Y-%m-%d").strftime("%d %b %Y")
    except ValueError:
        return str(iso)


def _with_ref(report_metadata: Optional[dict[str, Any]]) -> dict[str, Any]:
    meta = dict(report_metadata or {})
    meta.setdefault("ref_no", f"ATT-{datetime.now():%Y%m%d-%H%M%S}")
    return meta


def _build(buffer: io.BytesIO, title: str, school: dict[str, Any], meta: dict[str, Any], body: list, signatories: list[str]) -> None:
    st = _Stationery(school, meta.get("office") or _office_for(title), meta["ref_no"])

    first = Frame(MARGIN, MARGIN + 6, WIDTH, PAGE[1] - 2 * MARGIN - st.letterhead_height() - 6, id="first", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    later = Frame(MARGIN, MARGIN + 6, WIDTH, PAGE[1] - 2 * MARGIN - 30 - 6, id="later", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc = BaseDocTemplate(
        buffer,
        pagesize=PAGE,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title=f"{st.name} — {title.title()}",
        author=st.name,
        subject=meta.get("subtitle") or "",
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="First", frames=[first], onPage=st.first_page, autoNextPageTemplate="Later"),
            PageTemplate(id="Later", frames=[later], onPage=st.later_page),
        ]
    )
    story = _title_block(title, meta.get("subtitle"), meta.get("note")) + body + [_sign_off(signatories)]
    doc.build(story, canvasmaker=_numbered_canvas(st))


def _signatories(title: str) -> list[str]:
    if "teacher" in title.lower() or "staff" in title.lower():
        return ["Prepared by — HR / Secretary", "Principal"]
    return ["Prepared by — Deputy principal", "Principal"]


def build_report_pdf(
    buffer: io.BytesIO,
    title: str,
    school: dict[str, Any],
    table_rows: list[list[Any]],
    table_headers: list[str],
    report_metadata: Optional[dict[str, Any]] = None,
    col_widths_mm: Optional[list[float]] = None,
) -> None:
    """One ruled table under the letterhead."""
    meta = _with_ref(report_metadata)
    body: list = [_particulars(_particulars_for(meta, len(table_rows))), Spacer(1, 5 * mm)]
    if table_rows:
        body.append(_ruled_table(table_headers, table_rows, col_widths_mm))
    else:
        body.append(Paragraph("No attendance records in this period.", _S["empty"]))
    _build(buffer, title, school, meta, body, _signatories(title))


def build_report_pdf_class_sections(
    buffer: io.BytesIO,
    title: str,
    school: dict[str, Any],
    sections: list[tuple[str, list[str], list[list[Any]]]],
    report_metadata: Optional[dict[str, Any]] = None,
    col_widths_mm: Optional[list[float]] = None,
) -> None:
    """Same letterhead, then one titled table per class; a class starts a new page only when it would not fit."""
    meta = _with_ref(report_metadata)
    total = sum(len(rows) for _, _, rows in sections)
    body: list = [_particulars(_particulars_for(meta, total)), Spacer(1, 5 * mm)]
    if not sections:
        body.append(Paragraph("No attendance records in this period.", _S["empty"]))
    for i, (heading, headers, rows) in enumerate(sections):
        if i:
            body.append(Spacer(1, 6 * mm))
        body.append(CondPageBreak(45 * mm))  # never leave a class heading alone at a page foot
        label = re.sub(r"^CLASS:\s*", "", heading)
        body += _section_heading(f"Class: {label}", f"{len(rows)} record{'s' if len(rows) != 1 else ''}")
        body.append(_ruled_table(headers, rows, col_widths_mm) if rows else Paragraph("No records for this class.", _S["empty"]))
    _build(buffer, title, school, meta, body, _signatories(title))
