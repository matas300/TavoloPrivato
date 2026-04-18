import json
import os
import sys
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def fmt_date(value):
    if not value:
        return ""
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%d/%m/%Y")


def fmt_eur(value):
    return f"EUR {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ContractTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#3b2418"),
            spaceAfter=12,
        ),
        "kicker": ParagraphStyle(
            "Kicker",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=colors.HexColor("#bf5b2b"),
            spaceAfter=6,
            uppercase=True,
        ),
        "heading": ParagraphStyle(
            "Heading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#3b2418"),
            spaceBefore=8,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#4a4039"),
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#6f655d"),
        ),
    }


def build_story(payload):
    contract = payload["contract"]
    restaurant = payload["restaurant"]
    worker = payload["worker"]
    clauses = payload["clauses"]
    milestones = payload["milestones"]
    scope = payload.get("scopeOfWork", [])
    styles = build_styles()
    story = []

    story.append(Paragraph("Documento contrattuale generato dalla piattaforma", styles["kicker"]))
    story.append(Paragraph(contract["contractTitle"], styles["title"]))
    story.append(
        Paragraph(
            f"Accordo tra <b>Committente</b> {restaurant['legalName']} ({restaurant['vatNumber']}) "
            f"e <b>Prestatore d'Opera</b> {worker['displayName']} ({worker.get('vatNumber') or 'P.IVA da completare'}).",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            f"Periodo contrattuale: dal <b>{fmt_date(contract['serviceStartDate'])}</b> al <b>{fmt_date(contract['serviceEndDate'])}</b>. "
            f"Corrispettivo complessivo: <b>{fmt_eur(contract['taxableAmountEur'])}</b>.",
            styles["body"],
        )
    )
    story.append(Spacer(1, 4))

    story.append(Paragraph("Perimetro della prestazione", styles["heading"]))
    for item in scope:
        story.append(Paragraph(f"- {item}", styles["body"]))

    for clause in clauses:
        story.append(Paragraph(clause["heading"], styles["heading"]))
        story.append(Paragraph(clause["body"], styles["body"]))

    story.append(Paragraph("Piano economico mensile", styles["heading"]))
    rows = [["Milestone", "Periodo", "Compenso", "Fee piattaforma", "Netto Prestatore", "Scadenza"]]
    for item in milestones:
        rows.append(
            [
                item["milestoneLabel"],
                f"{fmt_date(item['periodStart'])} - {fmt_date(item['periodEnd'])}",
                fmt_eur(item["taxableAmountEur"]),
                fmt_eur(item["platformFeeEur"]),
                fmt_eur(item["workerNetEur"]),
                fmt_date(item["dueDate"]),
            ]
        )

    table = Table(rows, colWidths=[42 * mm, 38 * mm, 26 * mm, 26 * mm, 30 * mm, 24 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f5e2d7")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#3b2418")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d9c4b2")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fcf7f3")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Firme", styles["heading"]))
    story.append(
        Paragraph(
            "Il presente documento e predisposto per firma digitale o firma elettronica avanzata da parte del Committente e del Prestatore d'Opera.",
            styles["body"],
        )
    )
    signature_table = Table(
        [
            ["Committente", "Prestatore d'Opera"],
            ["", ""],
            ["______________________________", "______________________________"],
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    signature_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(signature_table)
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "Nota operativa: il testo e orientato alla prestazione autonoma e non descrive il rapporto con categorie tipiche del lavoro subordinato.",
            styles["small"],
        )
    )

    return story


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python generate_contract_pdf.py input.json output.pdf")

    input_path, output_path = sys.argv[1], sys.argv[2]
    with open(input_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=18 * mm,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        bottomMargin=16 * mm,
        title=payload["contract"]["contractTitle"],
        author="TavoloLibero ContractAgent",
    )
    doc.build(build_story(payload))


if __name__ == "__main__":
    main()
