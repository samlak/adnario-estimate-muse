"""The demo firm's people and projects (README §13); each project's files are in samples/<folder>."""

DEMO = 'Demo Partners QS'
PEOPLE = [
    ('Ada Okafor', 'admin@demo.adnario.app', 'admin'),
    ('Tunde Bello', 'qs@demo.adnario.app', 'qs'),
    ('Chidi Eze', 'architect@demo.adnario.app', 'contributor'),
    ('Ngozi Adeyemi', 'client@demo.adnario.app', 'viewer'),
]
PROJECTS = [
    ('Lekki Office Block', 'Lekki Gardens Holdings', 'Lekki, Lagos', 'Two-storey steel-framed office block with lifts, HVAC plant and full electrical fit-out.',
     'lekki-office', ['Office_ARC.ifc', 'Office_STR.ifc', 'Office_ELE.ifc']),
    ('Ikeja Corporate Office', 'Ikeja Holdings Ltd', 'Ikeja, Lagos', 'Corporate office building, architectural model only.',
     'ikeja-office', ['Ikeja_Office.ifc']),
    ('Ikoyi Duplex', 'Private client', 'Ikoyi, Lagos', 'Two-storey residential duplex.', 'ikoyi-duplex', ['Ifc2x3_Duplex_Architecture.ifc']),
]
# these open finished, from their saved estimate.json; the rest are left for the person to run (with a Muse key)
FINISHED = {'lekki-office', 'ikeja-office'}
