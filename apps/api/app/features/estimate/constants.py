"""The estimate's fixed lists and limits: the bills and sections in Nigerian elemental order, units and measuring
methods, the IFC classes read or skipped, batch sizes for the AI, and upload limits."""

import re

# ── Bills, sections, units ──
# Nigerian elemental order: bill B the building, C the services, D the external works
BILLS = {
    'B': ('Main Building', ['Substructure', 'Frame', 'Upper floors', 'Stairs', 'Walls', 'Roof', 'Windows', 'Doors',
                            'Wall finishes', 'Floor finishes', 'Ceiling finishes', 'Fittings and furnishings']),
    'C': ('M&E Services', ['Sanitary installations', 'Plumbing and drainage', 'Mechanical installations',
                           'Electrical installations', 'Lift installations', 'Fire protection']),
    'D': ('External Works', ['External works', 'Drainage', 'Fencing and gates']),
}
SECTIONS = [section for _, sections in BILLS.values() for section in sections]
BILL_OF = {section: bill for bill, (_, sections) in BILLS.items() for section in sections}
UNITS = {'m', 'm²', 'm³', 'nr', 't', 'kg', 'item'}
METHODS = {
    'count': 'nr', 'length': 'm', 'area': 'm²', 'volume': 'm³', 'weight': 't', 'item': 'item',
}
LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'  # a bill's item letters: I and O are skipped

# ── Reading the model ──
SKIP = ('IfcOpeningElement', 'IfcSpace', 'IfcVirtualElement', 'IfcAnnotation', 'IfcFeatureElement', 'IfcGrid')
STEEL_DENSITY = 7.85  # t/m³
# when the same element is in two models, which one bills it: the structure governs the frame, foundations and
# structural slabs; the architecture everything else
STRUCTURAL = ('IfcBeam', 'IfcColumn', 'IfcFooting', 'IfcPile', 'IfcMember')
LINEAR = ('length', 'width', 'height', 'perimeter', 'thickness')
GENERIC = re.compile(r'^\s*(type\s*\d+|default|generic|standard|untitled|unnamed|\d+)\s*$', re.I)

# ── The run ──
MAP_BATCH = 22  # types per Map call
PARALLEL = 4  # AI calls at a time
MATERIALS = {
    'concrete': ('concrete', 'cement', 'cast'), 'steel': ('steel', 'metal', 'iron'), 'timber': ('timber', 'wood', 'plywood'),
    'block': ('block', 'masonry', 'cmu', 'sandcrete'), 'brick': ('brick',), 'glass': ('glass', 'glazing'),
    'aluminium': ('aluminium', 'aluminum'), 'plasterboard': ('plasterboard', 'gypsum', 'drywall'),
}

# ── Link to cost ──
LINK_BATCH = 40  # BOQ lines per call
COUNTED = {'nr', 'point', 'set', 'item'}

# ── Uploads, edits and long work ──
DOCUMENT_LIMIT = 50 * 1024 * 1024
MAX_DOCUMENTS = 10
UNDO_STEPS = 50
WORK_KINDS = ('run', 'boq', 'link', 'programme')  # the long work an estimate can be running

# ── Exports ──
NAVY = '#1F3864'
FONTS = [  # a face with the naira sign: Arial (macOS, Windows), DejaVu (Linux, the Docker image), else Helvetica
    ('/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'),
    ('C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/arialbd.ttf'),
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
]
