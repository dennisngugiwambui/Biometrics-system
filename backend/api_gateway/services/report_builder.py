"""Build PDF reports with school branding and signature lines."""

import base64
import io
import re
from datetime import date
from typing import Any, Optional
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Image,
    PageBreak,
)


def _decode_logo_image(logo_data_url: Optional[str], max_width: float = 40 * mm, max_height: float = 25 * mm):
    """Decode data URL to reportlab Image or None."""
    if not logo_data_url or not logo_data_url.startswith("data:"):
        return None
    try:
        # data:image/png;base64,...
        match = re.match(r"data:image/[^;]+;base64,(.+)", logo_data_url)
        if not match:
            return None
        raw = base64.b64decode(match.group(1))
        img = Image(io.BytesIO(raw), width=max_width, height=max_height)
        return img
    except Exception:
        return None


def _pdf_flowable_cell(val: Any, style: ParagraphStyle) -> Any:
    """Wrap plain text in Paragraph so ReportLab wraps inside column widths."""
    if val is None:
        return Paragraph("", style)
    if isinstance(val, (Paragraph, Image)):
        return val
    return Paragraph(xml_escape(str(val)).replace("\n", "<br/>"), style)


def build_report_pdf(
    buffer: io.BytesIO,
    title: str,
    school: dict[str, Any],
    table_rows: list[list[Any]],
    table_headers: list[str],
    report_metadata: Optional[dict[str, Any]] = None,
    col_widths_mm: Optional[list[float]] = None,
) -> None:
    """
    Build a premium institutional PDF report with formal signatures and refined styling.
    """
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    
    # --- Custom Typography ---
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        alignment=1,  # Center
        leading=18,
        spaceAfter=4,
        textColor=colors.HexColor("#1A202C")
    )
    subtitle_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        alignment=1,
        leading=14,
        spaceAfter=2,
        textColor=colors.HexColor("#4A5568")
    )
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#2D3748")
    )
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#1A202C")
    )
    table_head_cell_style = ParagraphStyle(
        "TableHeadCell",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.whitesmoke,
    )
    table_body_cell_style = ParagraphStyle(
        "TableBodyCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1A202C"),
    )
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=colors.HexColor("#2B6CB0"), # Professional Blue
        spaceBefore=12,
        spaceAfter=8,
        borderPadding=(0, 0, 2, 0),
        borderWidth=0.5,
        borderColor=colors.HexColor("#E2E8F0")
    )

    story = []

    # 1. PREMIUM INSTITUTIONAL HEADER
    # ---------------------------------------------------------
    branding = school.get("branding") or {}
    logo_data_url = branding.get("logoDataUrl")
    logo_img = _decode_logo_image(logo_data_url, max_width=25*mm, max_height=25*mm)
    
    school_name = school.get("name", "OFFICIAL INSTITUTIONAL RECORD").upper()
    
    header_content = []
    if logo_img:
        header_content.append(logo_img)
        header_content.append(Spacer(1, 4*mm))
    
    header_content.extend([
        Paragraph(school_name, title_style),
        Paragraph(title.upper(), subtitle_style),
    ])
    
    header_table = Table([[header_content]], colWidths=[174*mm])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10*mm),
    ]))
    story.append(header_table)

    # 2. DOCUMENT METADATA (Grid)
    # ---------------------------------------------------------
    r_data = report_metadata or {}
    # Formatting date range
    date_from = r_data.get('date_from')
    date_to = r_data.get('date_to')
    
    if date_from and date_to:
        report_period = f"{date_from} to {date_to}"
    else:
        report_period = "Daily Snapshot"

    meta_data = [
        [Paragraph("Report Period", label_style), Paragraph(report_period, value_style), 
         Paragraph("Report Date", label_style), Paragraph(r_data.get('date', date.today().strftime('%b %d, %Y')), value_style)],
        [Paragraph("Category", label_style), Paragraph(r_data.get('category', 'Attendance Output'), value_style),
         Paragraph("Reference No.", label_style), Paragraph(r_data.get('ref_no', f"SBS-{date.today().year}-{id(buffer) % 1000:03d}"), value_style)]
    ]
    
    meta_table = Table(meta_data, colWidths=[35*mm, 52*mm, 35*mm, 52*mm])
    meta_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F7FAFC")),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#F7FAFC")),
        ('TOPPADDING', (0,0), (-1,-1), 2*mm),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2*mm),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10*mm))

    # 3. ATTENDANCE / PERFORMANCE DATA
    # ---------------------------------------------------------
    story.append(Paragraph("SUMMARY OF RECORDS", section_style))
    
    # Column widths: explicit mm avoids datetime + device columns overlapping
    if col_widths_mm and len(col_widths_mm) == len(table_headers):
        col_widths = [w * mm for w in col_widths_mm]
    else:
        col_widths = [174 * mm / len(table_headers)] * len(table_headers)
    header_flow = [_pdf_flowable_cell(h, table_head_cell_style) for h in table_headers]
    body_flow = [
        [_pdf_flowable_cell(c, table_body_cell_style) for c in row] for row in table_rows
    ]
    full_table_data = [header_flow] + body_flow

    main_table = Table(full_table_data, colWidths=col_widths, repeatRows=1, splitByRow=0)
    main_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2D3748")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.2, colors.HexColor("#CBD5E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0,0), (-1,-1), 2*mm),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2*mm),
        ('LEFTPADDING', (0,0), (-1,-1), 3*mm),
    ]))
    story.append(main_table)

    # 4. FORMAL SIGNATURE SECTION
    # ---------------------------------------------------------
    story.append(Spacer(1, 25*mm))
    
    sig_line = Table([
        ["_" * 35, "", "_" * 35],
        [Paragraph("School Principal", label_style), "", Paragraph("School Secretary", label_style)],
        [Paragraph("(Signature & Official Rubber Stamp)", value_style), "", Paragraph("(Signature & Date)", value_style)]
    ], colWidths=[75*mm, 24*mm, 75*mm])
    
    sig_line.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(sig_line)

    doc.build(story)


def build_report_pdf_class_sections(
    buffer: io.BytesIO,
    title: str,
    school: dict[str, Any],
    sections: list[tuple[str, list[str], list[list[Any]]]],
    report_metadata: Optional[dict[str, Any]] = None,
    col_widths_mm: Optional[list[float]] = None,
) -> None:
    """
    Same institutional header as build_report_pdf, then one table per section.
    Each section starts on a new page (after the first) so classes stay grouped.
    Table rows use splitByRow=0 so a data row is not split across pages.
    """
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "MainTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        alignment=1,
        leading=18,
        spaceAfter=4,
        textColor=colors.HexColor("#1A202C"),
    )
    subtitle_style = ParagraphStyle(
        "SubTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        alignment=1,
        leading=14,
        spaceAfter=2,
        textColor=colors.HexColor("#4A5568"),
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#2D3748"),
    )
    value_style = ParagraphStyle(
        "Value",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#1A202C"),
    )
    sec_table_head_cell_style = ParagraphStyle(
        "SecTableHeadCell",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.whitesmoke,
    )
    sec_table_body_cell_style = ParagraphStyle(
        "SecTableBodyCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1A202C"),
    )
    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=colors.HexColor("#2B6CB0"),
        spaceBefore=12,
        spaceAfter=8,
        borderPadding=(0, 0, 2, 0),
        borderWidth=0.5,
        borderColor=colors.HexColor("#E2E8F0"),
    )
    class_heading_style = ParagraphStyle(
        "ClassHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        textColor=colors.HexColor("#1A365D"),
        spaceBefore=6,
        spaceAfter=6,
    )

    story: list[Any] = []
    branding = school.get("branding") or {}
    logo_img = _decode_logo_image(branding.get("logoDataUrl"), max_width=25 * mm, max_height=25 * mm)
    school_name = school.get("name", "OFFICIAL INSTITUTIONAL RECORD").upper()
    header_content = []
    if logo_img:
        header_content.append(logo_img)
        header_content.append(Spacer(1, 4 * mm))
    header_content.extend(
        [
            Paragraph(school_name, title_style),
            Paragraph(title.upper(), subtitle_style),
        ]
    )
    header_table = Table([[header_content]], colWidths=[174 * mm])
    header_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10 * mm),
            ]
        )
    )
    story.append(header_table)

    r_data = report_metadata or {}
    date_from = r_data.get("date_from")
    date_to = r_data.get("date_to")
    if date_from and date_to:
        report_period = f"{date_from} to {date_to}"
    else:
        report_period = "Daily Snapshot"
    meta_data = [
        [
            Paragraph("Report Period", label_style),
            Paragraph(report_period, value_style),
            Paragraph("Report Date", label_style),
            Paragraph(r_data.get("date", date.today().strftime("%b %d, %Y")), value_style),
        ],
        [
            Paragraph("Category", label_style),
            Paragraph(r_data.get("category", "Attendance Output"), value_style),
            Paragraph("Reference No.", label_style),
            Paragraph(r_data.get("ref_no", f"SBS-{date.today().year}-{id(buffer) % 1000:03d}"), value_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[35 * mm, 52 * mm, 35 * mm, 52 * mm])
    meta_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F7FAFC")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F7FAFC")),
                ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("RECORDS BY CLASS (ONE SECTION PER PAGE)", section_style))

    table_style = TableStyle(
        [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2D3748")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#CBD5E0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
            ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ]
    )

    if not sections:
        story.append(Paragraph("No records in this period.", value_style))
    else:
        for i, (class_title, table_headers, table_rows) in enumerate(sections):
            if i > 0:
                story.append(PageBreak())
            story.append(Paragraph(xml_escape(class_title), class_heading_style))
            if not table_rows:
                story.append(Paragraph("No rows for this class.", value_style))
                story.append(Spacer(1, 4 * mm))
                continue
            if col_widths_mm and len(col_widths_mm) == len(table_headers):
                col_widths = [w * mm for w in col_widths_mm]
            else:
                col_widths = [174 * mm / len(table_headers)] * len(table_headers)
            hdr = [_pdf_flowable_cell(h, sec_table_head_cell_style) for h in table_headers]
            body = [[_pdf_flowable_cell(c, sec_table_body_cell_style) for c in row] for row in table_rows]
            full_data = [hdr] + body
            tbl = Table(full_data, colWidths=col_widths, repeatRows=1, splitByRow=0)
            tbl.setStyle(table_style)
            story.append(tbl)
            story.append(Spacer(1, 6 * mm))

    story.append(Spacer(1, 20 * mm))
    sig_line = Table(
        [
            ["_" * 35, "", "_" * 35],
            [Paragraph("School Principal", label_style), "", Paragraph("School Secretary", label_style)],
            [
                Paragraph("(Signature & Official Rubber Stamp)", value_style),
                "",
                Paragraph("(Signature & Date)", value_style),
            ],
        ],
        colWidths=[75 * mm, 24 * mm, 75 * mm],
    )
    sig_line.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(sig_line)
    doc.build(story)
