import io
import re
import zipfile


def revision_name(revision: int) -> str:
    """Takeoff 1, then Rev A, Rev B… for each new revision of the estimate."""
    return 'Takeoff 1' if revision == 0 else f'Rev {chr(64 + revision)}'


def text_of(name: str, data: bytes) -> str:
    """The text of a project document: PDF, Word (.docx) or plain text."""
    if name.lower().endswith('.pdf'):
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return '\n'.join(page.extract_text() or '' for page in pdf.pages)
    if name.lower().endswith('.docx'):
        xml = zipfile.ZipFile(io.BytesIO(data)).read('word/document.xml').decode()
        return re.sub(r'<[^>]+>', ' ', xml.replace('</w:p>', '\n'))
    return data.decode('utf-8', 'replace')


def file_name(project_name: str) -> str:
    """A project's name as it goes into an export's file name."""
    return re.sub(r'[^A-Za-z0-9]+', '_', project_name).strip('_')
