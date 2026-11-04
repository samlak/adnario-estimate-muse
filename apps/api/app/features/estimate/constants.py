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
# the solids whose shape is read (faces for formwork, the checks, and any quantity the model leaves out)
SHAPED = ('IfcFooting', 'IfcPile', 'IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcWall', 'IfcStair', 'IfcRamp', 'IfcRoof',
          'IfcReinforcingBar', 'IfcReinforcingMesh')

# ── The measuring convention ──
# BESMM4R follows the SMM7 tradition; these are its rules as the takeoff applies them, in one place for a QS to change
RULES = {
    'wall_void': 0.50,  # m²: voids this size or smaller are not deducted from walls, finishes and linings
    'soffit_void': 5.00,  # m²: voids this size or smaller are not deducted from soffit formwork
    'edge_bands': ((0.25, 'not exceeding 250mm high'), (0.5, '250 - 500mm high'), (1.0, '500mm - 1m high')),  # else "over 1m high"
    'blinding_mm': 50,
    'ground_within': 0.5,  # m: a slab whose underside is this close to the lowest storey bears on the ground
    'densities': {'steel': 7.85, 'iron': 7.85, 'metal': 7.85, 'aluminium': 2.70, 'aluminum': 2.70},  # t/m³
    # kg of bar per m³ of concrete, for the provisional reinforcement when the model has no bars
    'rebar_kg_m3': {'foundations': 80, 'ground slab': 80, 'suspended slabs': 100, 'beams': 180, 'columns': 200, 'walls': 100, 'stairs': 80},
    'hardcore_m': 0.15,  # m: hardcore bed under a ground slab, when the model has none
    'reduced_level_m': 0.15,  # m: excavation to reduce levels under a ground slab
}
# a word in the description or the model's material that makes it in-situ concrete, and the words that rule it out
IN_SITU = ('concrete', 'cement', 'cast', 'rc ', 'r.c.', 'reinforced', 'c20', 'c25', 'c30', 'c35', 'c40', '1:2:4', '1:1.5:3')
NOT_IN_SITU = re.compile(r'precast|pre-cast|hollow.?core|plank|blinding|screed|lean mix|1:3:6|block|topping to hollow', re.I)
ON_DECK = re.compile(r'deck|plank|hollow.?core|permanent formwork|precast', re.I)  # a slab cast on these needs no soffit formwork
HOLLOW = re.compile(r'\b(hss|shs|rhs|chs|tube|pipe|hollow)\b', re.I)
# the rate card item each derived kind is priced from, with no AI (Adnario Market Rates codes)
DERIVED_RATE = {'formwork_foundations': 'FOR-01', 'formwork_columns': 'FOR-02', 'formwork_beams': 'FOR-03',
                'formwork_soffit': 'FOR-04', 'formwork_stairs': 'FOR-05', 'formwork_walls': 'FOR-06', 'formwork_slab_edge': 'FOR-09',
                'blinding': 'CON-15', 'dpm': 'EAR-07', 'anti_termite': 'EAR-11', 'rebar': 'REI-01', 'mesh': 'REI-02'}
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
