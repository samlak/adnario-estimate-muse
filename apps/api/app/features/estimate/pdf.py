"""The BOQ as a PDF tender document."""

import io
import re
from datetime import date

from app.features.estimate.boq import display_refs, ordered, totals
from app.features.estimate.constants import FONTS


def pdf_fonts() -> tuple[str, str, str]:
    """(regular, bold, naira sign) for the PDF."""
    from pathlib import Path

    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    for regular, bold in FONTS:
        if Path(regular).exists() and Path(bold).exists():
            if 'BoqSans' not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont('BoqSans', regular))
                pdfmetrics.registerFont(TTFont('BoqSans-Bold', bold))
            return 'BoqSans', 'BoqSans-Bold', '₦'
    return 'Helvetica', 'Helvetica-Bold', 'N'


def boq_pdf(project: dict, result: dict) -> bytes:
    """The BOQ as a tender document, laid out as the samples (database/seed/samples/*/..._BOQ.pdf): a navy cover, the
    General Summary and notes, then each bill under its elements, carried to the summary."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    regular, bold, naira_sign = pdf_fonts()
    navy, rule, shade, grey = colors.HexColor('#183A5E'), colors.HexColor('#C9CED4'), colors.HexColor('#EEF2F7'), colors.HexColor('#DDDDDD')
    width, height = A4
    body = ParagraphStyle('body', fontName=regular, fontSize=8.5, leading=10.8)
    strong = ParagraphStyle('strong', parent=body, fontName=bold)
    heading = ParagraphStyle('heading', fontName=bold, fontSize=16, leading=20, textColor=navy, spaceAfter=8)
    note = ParagraphStyle('note', fontName=regular, fontSize=9.5, leading=13.5)
    boq = ordered(result['boq'])
    refs = display_refs(boq)
    pricing = result['pricing']
    summary = totals(boq, pricing)
    models = ', '.join(model['name'] for model in result.get('models', [])) or 'the building models'
    firm = project.get('firm') or ''
    money = lambda value: '' if value is None else f'{value:,.2f}'

    def cover(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(navy)
        canvas.rect(0, 0, width, height, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont(regular, 13)
        canvas.drawString(26 * mm, height - 40 * mm, 'BILLS OF QUANTITIES')
        canvas.setFont(bold, 30)
        canvas.drawString(26 * mm, height - 62 * mm, project['name'].upper()[:32])
        canvas.setFillColor(colors.HexColor('#C9A24A'))
        canvas.rect(26 * mm, height - 70 * mm, 24 * mm, 1.2 * mm, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        rows = [('PREPARED BY', firm), ('MEASURED FROM', models[:70]), ('METHOD', 'BESMM4R; Nigerian elements'),
                ('CURRENCY', 'Nigerian Naira'), ('DATE', f'{date.today():%d %B %Y}')]
        if project.get('client'):
            rows.insert(1, ('CLIENT', project['client']))
        if project.get('location'):
            rows.insert(2 if project.get('client') else 1, ('LOCATION', project['location']))
        y = height * 0.36
        for label, value in rows:
            canvas.setFont(bold, 11)
            canvas.drawString(26 * mm, y, label)
            canvas.setFont(regular, 11)
            canvas.drawString(76 * mm, y, value)
            y -= 10 * mm
        canvas.restoreState()

    def page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(navy)
        canvas.rect(0, height - 11 * mm, width, 11 * mm, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont(bold, 8)
        canvas.drawString(16 * mm, height - 6.8 * mm, 'BILLS OF QUANTITIES')
        canvas.setFont(regular, 8)
        canvas.drawRightString(width - 16 * mm, height - 6.8 * mm, project['name'])
        canvas.setFillColor(colors.HexColor('#59636E'))
        canvas.drawString(16 * mm, 10 * mm, f'{firm} · measured from the building models' if firm else 'Measured from the building models')
        canvas.drawRightString(width - 16 * mm, 10 * mm, f'Page {doc.page}')
        canvas.restoreState()

    def grid(rows: int, extra: list) -> TableStyle:
        return TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), regular), ('FONTSIZE', (0, 0), (-1, -1), 8.5), ('LEADING', (0, 0), (-1, -1), 10.8),
            ('BACKGROUND', (0, 0), (-1, 0), navy), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white), ('FONTNAME', (0, 0), (-1, 0), bold),
            ('GRID', (0, 0), (-1, -1), 0.4, rule), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 5), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            *extra,
        ])

    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=22 * mm, bottomMargin=20 * mm,
                            title=f'Bills of Quantities: {project["name"]}', author=firm)
    story: list = [PageBreak()]  # the cover is drawn on the first page

    # the General Summary
    rows = [['Ref', 'Description', f'Amount ({naira_sign})'], ['A', f'Preliminaries ({pricing.get("prelims", 0):g}% of measured work)', money(summary['prelims'])]]
    rows += [[bill, value['name'], money(value['total'])] for bill, value in summary['bills'].items()]
    first_total = len(rows)
    rows += [['', 'Sub-total', money(summary['measured'] + summary['prelims'])],
             ['', f'Contingency {pricing.get("contingency", 0):g}%', money(summary['contingency'])],
             ['', f'VAT {pricing.get("vat", 0):g}%', money(summary['vat'])],
             ['', 'TOTAL CARRIED TO FORM OF TENDER', money(summary['total'])]]
    story += [Paragraph('General Summary', heading), Table(rows, colWidths=[19 * mm, 109 * mm, 50 * mm], style=grid(len(rows), [
        ('ALIGN', (2, 1), (2, -1), 'RIGHT'), ('FONTNAME', (1, first_total), (-1, -1), bold),
        ('BACKGROUND', (0, -1), (-1, -1), grey),
    ]))]
    notes = [
        'Quantities are measured from the building models (IFC) by code, to BESMM4R, and grouped into the items below.',
        'Every item traces to the model elements it was measured from.',
        "Rates are from the firm's rate library; an item without a rate is left blank for pricing and adds nothing.",
        'Preliminaries, contingency and VAT are percentages on the summary, never inside the rates.',
    ]
    if summary['unpriced']:
        notes.append(f'{summary["unpriced"]} item(s) have no rate yet and are not in the totals.')
    story += [Spacer(1, 5 * mm), Paragraph('Notes', heading), *[Paragraph(text, note) for text in notes]]

    # each bill, under its elements (B1 Substructure, B2 Frame...), carried to the summary
    for bill, value in summary['bills'].items():
        lines = [line for line in boq if line['bill'] == bill]
        rows = [['Item', 'Description', 'Qty', 'Unit', f'Rate ({naira_sign})', f'Amount ({naira_sign})']]
        sections = []
        for number, name in enumerate(dict.fromkeys(line['section'] for line in lines), start=1):
            sections.append(len(rows))
            rows.append([f'{bill}{number}', Paragraph(name.upper(), strong), '', '', '', ''])
            for line in (line for line in lines if line['section'] == name):
                amount = None if line['rate'] is None else (line['qty'] or 0) * line['rate']
                rows.append([re.sub(r'^[A-Z]\d+', '', refs[line['code']]), Paragraph(line['description'], body), f'{line["qty"] or 0:,.2f}', line['unit'], money(line['rate']), money(amount)])
        rows.append(['', Paragraph(f'TOTAL OF BILL {bill} CARRIED TO SUMMARY', strong), '', '', '', money(value['total'])])
        style = [('ALIGN', (2, 1), (2, -1), 'RIGHT'), ('ALIGN', (4, 1), (5, -1), 'RIGHT'), ('BACKGROUND', (0, -1), (-1, -1), grey), ('FONTNAME', (0, -1), (-1, -1), bold)]
        for at in sections:
            style += [('BACKGROUND', (0, at), (-1, at), shade), ('FONTNAME', (0, at), (-1, at), bold)]
        story += [PageBreak(), Paragraph(f'BILL {bill}: {value["name"].upper()}', heading),
                  Table(rows, colWidths=[13 * mm, 84 * mm, 18 * mm, 13 * mm, 22 * mm, 28 * mm], repeatRows=1, style=grid(len(rows), style))]
    doc.build(story, onFirstPage=cover, onLaterPages=page)
    return out.getvalue()
