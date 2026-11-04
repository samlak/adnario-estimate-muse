"""The programme's fixed patterns and limits."""

import re

# a row of the programme PDF: ID, name, duration, start, finish, predecessors
ROW = re.compile(r'^(\d+) (.+?) (\d+) days? (\d\d \w{3} \d{4}) (\d\d \w{3} \d{4}) ?(.*)$')
LINK = re.compile(r'(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\s*\d+)?', re.I)
FLOOR = re.compile(r'^(FOUNDATION|GROUND FLOOR|FIRST FLOOR|SECOND FLOOR|THIRD FLOOR|\w+ FLOOR|ROOF|BASEMENT|LEVEL \w+|WHOLE BUILDING|EXTERNAL)$')
MAX_ROWS = 5000
PIECES_PER_CALL = 60  # pieces of BOQ work per AI call
PARALLEL = 4  # AI calls at a time
FIXED_HOLIDAYS = ((1, 1), (5, 1), (6, 12), (10, 1), (12, 25), (12, 26))  # New Year, Workers', Democracy, Independence, Christmas, Boxing Day
UPLOAD_LIMIT = 50 * 1024 * 1024  # bytes
PDF_HEADER = b'%PDF'
