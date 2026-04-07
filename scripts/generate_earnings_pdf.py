import json
import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def eur(value):
    return f"EUR {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def make_table(rows, widths):
    table = Table(rows, colWidths=widths, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5EDE0")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#2C1810")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D4C5A9")),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def main():
    if len(sys.argv) != 3:
      raise SystemExit("Usage: generate_earnings_pdf.py input.json output.pdf")

    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    result = payload["result"]
    page = payload["page"]
    output_path = sys.argv[2]
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        textColor=colors.HexColor("#2C1810"),
        leading=28,
        spaceAfter=10,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#6B5E55"),
        spaceAfter=10,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=colors.HexColor("#C25B2A"),
        spaceBefore=8,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2C1810"),
    )

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    audience_label = "Ristoratori" if result.get("audience") == "restaurant" else "Professionisti"
    story = [
        Paragraph("TavoloLibero - Simulatore guadagno e costo aziendale", title_style),
        Paragraph(f"Audience: {audience_label}", section_style),
        Paragraph(page["heroSubtitle"], subtitle_style),
        Spacer(1, 6),
        Paragraph(result["banner"], body_style),
        Spacer(1, 12),
        Paragraph("Input scenario", section_style),
        make_table(
            [
                ["Campo", "Valore"],
                ["Ruolo", result["input"]["ruoloLabel"]],
                ["Seniority", result["input"]["seniorityLabel"]],
                ["Esperienza", f'{result["input"]["anniEsperienza"]} anni'],
                ["Netto mensile attuale", eur(result["input"]["stipendioNettoMensileAttuale"])],
                ["Aliquota forfettario", f'{result["input"]["aliquotaForfettario"]}%'],
            ],
            [65 * mm, 95 * mm],
        ),
        Spacer(1, 12),
        Paragraph("Sintesi economica", section_style),
        make_table(
            [
                ["Voce", "Valore"],
                [page["employeeKicker"], eur(result["dipendente"]["nettoAnnuo"])],
                [page["companyKicker"], eur(result["azienda"]["costoTotale"])],
                [page["freelanceKicker"], eur(result["freelance"]["nettoAnnuo"])],
                ["Delta annuo", eur(result["delta"]["guadagnoAnnuo"])],
                ["Delta mensile", eur(result["delta"]["guadagnoMensile"])],
            ],
            [65 * mm, 95 * mm],
        ),
        Spacer(1, 12),
        Paragraph("Breakdown", section_style),
        make_table(
            [
                ["Componente", "Valore"],
                ["RAL stimata", eur(result["dipendente"]["ralStimata"])],
                ["INPS azienda", eur(result["azienda"]["contributiInps"])],
                ["INAIL", eur(result["azienda"]["premioInail"])],
                ["TFR", eur(result["azienda"]["tfr"])],
                ["Contributi INPS freelance", eur(result["freelance"]["contributiInps"])],
                ["Imposta sostitutiva", eur(result["freelance"]["tasseSostitutive"])],
            ],
            [65 * mm, 95 * mm],
        ),
        Spacer(1, 12),
        Paragraph("Note operative", section_style),
    ]

    for note in result["referenceSnapshot"]["notes"]:
        story.append(Paragraph(f"- {note}", body_style))

    for warning in result["warnings"]:
        story.append(Paragraph(f"- {warning}", body_style))

    story.extend(
        [
            Spacer(1, 12),
            Paragraph("Questo PDF e una sintesi commerciale del simulatore. Non sostituisce cedolino, consulenza del lavoro o parere fiscale personalizzato.", subtitle_style),
        ]
    )

    doc.build(story)


if __name__ == "__main__":
    main()
