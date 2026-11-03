"""Exports (README §9): the BOQ as Excel (a Summary sheet, then a sheet per bill; rates in a yellow column, every
amount a live formula written with its value), the BOQ as a PDF tender document, and the cash flow as Excel."""

import io
import re
from datetime import date

import xlsxwriter

from app.features.estimate import prompts
from app.features.estimate.boq import display_refs, ordered, totals

NAVY = '#1F3864'


def boq_excel(project: dict, result: dict) -> bytes:
    out = io.BytesIO()
    book = xlsxwriter.Workbook(out, {'in_memory': True})
    book.formats[0].set_font_size(10)  # as the samples: 10pt throughout
    fmt = lambda **options: book.add_format({'font_size': 10, **options})
    title = fmt(bold=True, font_size=13)
    note = fmt(font_size=9)
    head = fmt(bold=True, font_color='white', bg_color=NAVY)
    section = fmt(bold=True, bg_color='#D9E1F2')
    AMOUNT = '#,##0;(#,##0);-'
    section_money = fmt(bold=True, bg_color='#D9E1F2', num_format=AMOUNT)
    wrap = fmt(text_wrap=True, valign='top')
    qty = fmt(num_format='#,##0.00', valign='top')
    rate = fmt(num_format='#,##0.00', bg_color='#FFF2CC', valign='top')
    money = fmt(num_format=AMOUNT, valign='top')
    bold_money = fmt(num_format=AMOUNT, bold=True)
    bold = fmt(bold=True)
    percent = fmt(num_format='0.0%', bg_color='#FFF2CC')

    boq = ordered(result['boq'])
    refs = display_refs(boq)
    pricing = result['pricing']
    summary = totals(boq, pricing)
    models = ', '.join(model['name'] for model in result.get('models', []))
    sheet_of = {bill: f'{bill} {prompts.BILLS[bill][0]}' for bill in summary['bills']}
    summary_sheet = book.add_worksheet('Summary')
    bill_rows: dict[str, dict] = {}  # bill → {'total': cell, 'sections': [(name, cell)]}

    for bill in summary['bills']:
        sheet = book.add_worksheet(sheet_of[bill])
        sheet.set_column(0, 0, 7)
        sheet.set_column(1, 1, 64, wrap)
        sheet.set_column(2, 2, 12)
        sheet.set_column(3, 3, 6)
        sheet.set_column(4, 4, 14)
        sheet.set_column(5, 5, 17)
        sheet.freeze_panes(4, 0)
        sheet.repeat_rows(3)
        sheet.set_paper(9)
        sheet.fit_to_pages(1, 0)
        sheet.write(0, 0, f'BILL {bill}: {prompts.BILLS[bill][0].upper()}', title)
        sheet.write(1, 0, f'{project["name"]}. Measured from {models}. Enter rates in the yellow column; amounts and the Summary follow.', note)
        for col, text in enumerate(['Item', 'Description', 'Qty', 'Unit', 'Rate (₦)', 'Amount (₦)']):
            sheet.write(3, col, text, head)
        row = 4
        sections = []
        lines = [line for line in boq if line['bill'] == bill]
        names = list(dict.fromkeys(line['section'] for line in lines))
        for number, name in enumerate(names, start=1):
            mine = [line for line in lines if line['section'] == name]
            first, last = row + 2, row + 1 + len(mine)
            value = sum((line['qty'] or 0) * line['rate'] for line in mine if line['rate'] is not None)
            sheet.write(row, 0, number, section)
            sheet.write(row, 1, name, section)
            sheet.write(row, 2, None, section)
            sheet.write(row, 3, None, section)
            sheet.write(row, 4, None, section)
            sheet.write_formula(row, 5, f'=SUM(F{first}:F{last})', section_money, value)
            sections.append((name, f"'{sheet_of[bill]}'!F{row + 1}", value))
            row += 1
            for line in mine:
                sheet.write(row, 0, re.sub(r'^[A-Z]\d+', '', refs[line['code']]))
                sheet.write(row, 1, line['description'], wrap)
                sheet.write_number(row, 2, round(line['qty'] or 0, 3), qty)
                sheet.write(row, 3, line['unit'])
                if line['rate'] is None:
                    sheet.write_blank(row, 4, None, rate)
                else:
                    sheet.write_number(row, 4, line['rate'], rate)
                amount = '' if line['rate'] is None else (line['qty'] or 0) * line['rate']
                sheet.write_formula(row, 5, f'=IF(E{row + 1}="","",C{row + 1}*E{row + 1})', money, amount)
                row += 1
        row += 1
        sheet.write(row, 1, f'Total of Bill {bill} carried to Summary', bold)
        sheet.write_formula(row, 5, '=' + '+'.join(cell.split('!')[1] for _, cell, _ in sections), bold_money, summary['bills'][bill]['total'])
        bill_rows[bill] = {'total': f"'{sheet_of[bill]}'!F{row + 1}", 'sections': sections}

    # the Summary: A Preliminaries, each bill and its elements, then contingency and VAT on the yellow percentages
    s = summary_sheet
    s.set_column(0, 1, 6)
    s.set_column(2, 2, 50)
    s.set_column(3, 3, 9)
    s.set_column(4, 4, 20)
    s.freeze_panes(4, 0)
    s.set_paper(9)
    s.fit_to_pages(1, 0)
    s.write(0, 0, f'SUMMARY: {project["name"]}', title)
    s.write(1, 0, 'Amounts follow the rates in the bill sheets. Edit the yellow percentages.', note)
    for col, text in enumerate(['Bill', '', 'Description', '%', 'Amount (₦)']):
        s.write(3, col, text, head)
    row = 4
    prelims_row = row
    s.write(row, 0, 'A')
    s.write(row, 2, 'Preliminaries', bold)
    s.write_number(row, 3, pricing.get('prelims', 0) / 100, percent)
    row += 1
    bill_cells = []
    for bill, cells in bill_rows.items():
        s.write(row, 0, bill, section)
        s.write_blank(row, 1, None, section)
        s.write(row, 2, prompts.BILLS[bill][0], section)
        s.write_blank(row, 3, None, section)
        s.write_formula(row, 4, f'={cells["total"]}', section_money, summary['bills'][bill]['total'])
        bill_cells.append(f'E{row + 1}')
        row += 1
        for number, (name, cell, value) in enumerate(cells['sections'], start=1):
            s.write(row, 1, number)
            s.write(row, 2, name)
            s.write_formula(row, 4, f'={cell}', money, value)
            row += 1
    row += 1
    measured = row
    s.write(row, 2, f'Measured work (bills {", ".join(bill_rows)})')
    s.write_formula(row, 4, '=' + '+'.join(bill_cells), money, summary['measured'])
    s.write_formula(prelims_row, 4, f'=E{measured + 1}*D{prelims_row + 1}', money, summary['prelims'])
    s.write(row + 1, 2, 'Sub-total including preliminaries', bold)
    s.write_formula(row + 1, 4, f'=E{measured + 1}+E{prelims_row + 1}', bold_money, summary['measured'] + summary['prelims'])
    s.write(row + 2, 2, 'Contingency')
    s.write_number(row + 2, 3, pricing.get('contingency', 0) / 100, percent)
    s.write_formula(row + 2, 4, f'=E{row + 2}*D{row + 3}', money, summary['contingency'])
    s.write(row + 3, 2, 'Sub-total')
    s.write_formula(row + 3, 4, f'=E{row + 2}+E{row + 3}', money, summary['measured'] + summary['prelims'] + summary['contingency'])
    s.write(row + 4, 2, 'VAT')
    s.write_number(row + 4, 3, pricing.get('vat', 0) / 100, percent)
    s.write_formula(row + 4, 4, f'=E{row + 4}*D{row + 5}', money, summary['vat'])
    s.write(row + 5, 2, 'GRAND TOTAL', bold)
    s.write_formula(row + 5, 4, f'=E{row + 4}+E{row + 5}', bold_money, summary['total'])
    book.close()
    return out.getvalue()


FONTS = [  # a face with the naira sign: Arial (macOS, Windows), DejaVu (Linux, the Docker image), else Helvetica
    ('/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'),
    ('C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/arialbd.ttf'),
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
]


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
    """The BOQ as a tender document, laid out as the samples (overview/samples/*/..._BOQ.pdf): a navy cover, the
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


def cash_flow_excel(project: dict, programme: dict) -> bytes:
    """The cash flow month by month, in the BOQ workbook's style: the value of the work done, preliminaries,
    contingency and VAT, the month's total and the running total, each total a live formula."""
    out = io.BytesIO()
    book = xlsxwriter.Workbook(out, {'in_memory': True})
    book.formats[0].set_font_size(10)
    fmt = lambda **options: book.add_format({'font_size': 10, **options})
    AMOUNT = '#,##0;(#,##0);-'
    sheet = book.add_worksheet('Cash flow')
    head = fmt(bold=True, font_color='white', bg_color=NAVY)
    money = fmt(num_format=AMOUNT)
    total = fmt(bold=True, num_format=AMOUNT, bg_color='#D9E1F2')
    sheet.write(0, 0, f'CASH FLOW: {project["name"]}', fmt(bold=True, font_size=13))
    sheet.write(1, 0, f'{project.get("firm") or ""}. Value of the work done each month from the programme and the priced BOQ, with preliminaries, contingency and VAT.'.lstrip('. '), fmt(font_size=9))
    columns = ['Month', 'Work done', 'Preliminaries', 'Contingency', 'VAT', 'Month total', 'To date']
    for col, text in enumerate(columns):
        sheet.write(3, col, text, head)
    sheet.set_column(0, 0, 14)
    sheet.set_column(1, 6, 17)
    sheet.freeze_panes(4, 0)
    sheet.set_paper(9)
    sheet.fit_to_pages(1, 0)
    first = 4
    for at, month in enumerate(programme['cash_flow'], start=first):
        sheet.write(at, 0, date.fromisoformat(f'{month["month"]}-01').strftime('%b %Y') if re.match(r'^\d{4}-\d{2}$', month['month']) else month['month'])
        for col, key in enumerate(['work', 'prelims', 'contingency', 'vat'], start=1):
            sheet.write_number(at, col, round(month[key]), money)
        sheet.write_formula(at, 5, f'=SUM(B{at + 1}:E{at + 1})', money, round(month['total']))
        sheet.write_formula(at, 6, f'=F{at + 1}' if at == first else f'=G{at}+F{at + 1}', money, round(month['cumulative']))
    last = first + len(programme['cash_flow'])
    sheet.write(last, 0, 'Total', fmt(bold=True, bg_color='#D9E1F2'))
    for col, key in enumerate(['work', 'prelims', 'contingency', 'vat', 'total'], start=1):
        letter = 'ABCDEFG'[col]
        sheet.write_formula(last, col, f'=SUM({letter}{first + 1}:{letter}{last})', total, round(sum(m[key] for m in programme['cash_flow'])))
    sheet.write_blank(last, 6, None, total)
    book.close()
    return out.getvalue()
