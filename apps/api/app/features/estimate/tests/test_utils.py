"""Revision names, document text, export file names."""

import io
import zipfile

from app.features.estimate.utils import file_name, revision_name, text_of


def test_revision_names():
    assert [revision_name(n) for n in (0, 1, 2, 26)] == ['Takeoff 1', 'Rev A', 'Rev B', 'Rev Z']


def test_text_is_read_from_plain_text_and_word():
    assert text_of('brief.txt', 'Two storeys, Lekki'.encode()) == 'Two storeys, Lekki'
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as docx:
        docx.writestr('word/document.xml', '<w:p><w:r><w:t>Steel frame</w:t></w:r></w:p><w:p><w:t>No basement</w:t></w:p>')
    text = text_of('Spec.DOCX', out.getvalue())
    assert 'Steel frame' in text and 'No basement' in text and '<' not in text


def test_export_file_names():
    assert file_name('Lekki Office Block (Rev A)') == 'Lekki_Office_Block_Rev_A'
