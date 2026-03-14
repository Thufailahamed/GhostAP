"""PDF Invoice Generator using ReportLab."""
import io
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER


# Brand colors
BLACK = HexColor("#0a0a0a")
GREEN = HexColor("#00ff88")
DARK_GREEN = HexColor("#006633")
WHITE = HexColor("#ffffff")
GRAY = HexColor("#888888")
LIGHT_GRAY = HexColor("#f0f0f0")


def generate_invoice_pdf(
    invoice_number: str,
    customer_name: str,
    issue_date: str,
    due_date: str | None,
    total_amount: float,
    paid_amount: float,
    line_items: list[dict] | None = None,
    company_name: str = "AI Payable Ghost — Finance OS",
) -> bytes:
    """Generate a professional PDF invoice and return raw bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Custom styles
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Title"],
        fontSize=28,
        textColor=BLACK,
        spaceAfter=4 * mm,
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "InvoiceSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=GRAY,
        spaceAfter=8 * mm,
    )
    heading_style = ParagraphStyle(
        "SectionHead",
        parent=styles["Normal"],
        fontSize=11,
        textColor=DARK_GREEN,
        fontName="Helvetica-Bold",
        spaceBefore=6 * mm,
        spaceAfter=3 * mm,
    )
    normal_style = ParagraphStyle(
        "NormalText",
        parent=styles["Normal"],
        fontSize=10,
        textColor=BLACK,
    )
    right_style = ParagraphStyle(
        "RightText",
        parent=normal_style,
        alignment=TA_RIGHT,
    )
    bold_style = ParagraphStyle(
        "BoldText",
        parent=normal_style,
        fontName="Helvetica-Bold",
    )

    # --- Header ---
    elements.append(Paragraph(company_name, title_style))
    elements.append(Paragraph("INVOICE", subtitle_style))
    elements.append(Spacer(1, 4 * mm))

    # --- Invoice Details Table ---
    balance_due = max(0, total_amount - paid_amount)
    details_data = [
        [
            Paragraph("<b>Invoice Number</b>", normal_style),
            Paragraph(invoice_number, bold_style),
            Paragraph("<b>Bill To</b>", normal_style),
            Paragraph(customer_name, bold_style),
        ],
        [
            Paragraph("<b>Issue Date</b>", normal_style),
            Paragraph(issue_date or "N/A", normal_style),
            Paragraph("<b>Due Date</b>", normal_style),
            Paragraph(due_date or "On Receipt", normal_style),
        ],
        [
            Paragraph("<b>Total</b>", normal_style),
            Paragraph(f"${total_amount:,.2f}", bold_style),
            Paragraph("<b>Balance Due</b>", normal_style),
            Paragraph(f"${balance_due:,.2f}", bold_style),
        ],
    ]

    details_table = Table(details_data, colWidths=[30 * mm, 55 * mm, 30 * mm, 55 * mm])
    details_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, -1), (-1, -1), 1, LIGHT_GRAY),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 8 * mm))

    # --- Line Items ---
    elements.append(Paragraph("LINE ITEMS", heading_style))

    if line_items and len(line_items) > 0:
        header_row = [
            Paragraph("<b>#</b>", normal_style),
            Paragraph("<b>Description</b>", normal_style),
            Paragraph("<b>Qty</b>", right_style),
            Paragraph("<b>Unit Price</b>", right_style),
            Paragraph("<b>Total</b>", right_style),
        ]
        item_rows = [header_row]
        for i, item in enumerate(line_items, 1):
            item_rows.append([
                Paragraph(str(i), normal_style),
                Paragraph(item.get("description", "Item"), normal_style),
                Paragraph(str(item.get("quantity", 1)), right_style),
                Paragraph(f"${item.get('unit_price', 0):,.2f}", right_style),
                Paragraph(f"${item.get('total', item.get('total_price', 0)):,.2f}", right_style),
            ])
    else:
        # Single line item from the receivable total
        header_row = [
            Paragraph("<b>#</b>", normal_style),
            Paragraph("<b>Description</b>", normal_style),
            Paragraph("<b>Amount</b>", right_style),
        ]
        item_rows = [
            header_row,
            [
                Paragraph("1", normal_style),
                Paragraph("Invoice charges", normal_style),
                Paragraph(f"${total_amount:,.2f}", right_style),
            ],
        ]

    col_count = len(item_rows[0])
    if col_count == 5:
        col_widths = [10 * mm, 70 * mm, 20 * mm, 35 * mm, 35 * mm]
    else:
        col_widths = [10 * mm, 100 * mm, 60 * mm]

    items_table = Table(item_rows, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, 0), 1, DARK_GREEN),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, GRAY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, HexColor("#fafafa")]),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 8 * mm))

    # --- Totals Section ---
    totals_data = [
        ["", Paragraph("<b>Subtotal</b>", right_style), Paragraph(f"${total_amount:,.2f}", right_style)],
    ]
    if paid_amount > 0:
        totals_data.append(
            ["", Paragraph("<b>Paid</b>", right_style), Paragraph(f"-${paid_amount:,.2f}", right_style)]
        )
    totals_data.append(
        ["", Paragraph("<b>BALANCE DUE</b>", right_style), Paragraph(f"<b>${balance_due:,.2f}</b>", right_style)]
    )

    totals_table = Table(totals_data, colWidths=[90 * mm, 40 * mm, 40 * mm])
    totals_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE", (1, -1), (-1, -1), 2, DARK_GREEN),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 12 * mm))

    # --- Footer ---
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=GRAY,
        alignment=TA_CENTER,
    )
    elements.append(Paragraph(
        f"Generated by {company_name} on {datetime.datetime.now().strftime('%B %d, %Y')}",
        footer_style,
    ))
    elements.append(Paragraph("Thank you for your business.", footer_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
