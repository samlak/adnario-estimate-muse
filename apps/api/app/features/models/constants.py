UPLOAD_LIMIT = 200 * 1024 * 1024  # bytes per IFC
CONVERT_TIMEOUT = 900  # seconds the converter may take
STEP_HEADER = b'ISO-10303-21'  # how every IFC (STEP) file starts
OPEN_CACHED = 8  # IFC files kept open
COMPARED = ('type', 'quantity', 'position', 'material', 'properties')  # what a new version is compared on
