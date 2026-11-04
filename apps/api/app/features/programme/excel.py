"""The cash flow as Excel (README §9)."""

import io
import re
from datetime import date

import xlsxwriter

from app.features.estimate.constants import NAVY


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
