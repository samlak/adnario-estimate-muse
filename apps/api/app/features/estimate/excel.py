"""The BOQ as Excel (README §9): a Summary sheet, then a sheet per bill; rates in a yellow column, every amount a
live formula written with its value."""

import io
import re

import xlsxwriter

from app.features.estimate.boq import display_refs, ordered, totals
from app.features.estimate.constants import BILLS, NAVY


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
    sheet_of = {bill: f'{bill} {BILLS[bill][0]}' for bill in summary['bills']}
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
        sheet.write(0, 0, f'BILL {bill}: {BILLS[bill][0].upper()}', title)
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
        s.write(row, 2, BILLS[bill][0], section)
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
