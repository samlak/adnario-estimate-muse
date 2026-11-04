from app.features.comments.utils import mentioned, safe_name


def test_file_names_are_made_safe():
    assert safe_name('../../etc/passwd') == '.._.._etc_passwd'
    assert safe_name('Site photo (1).jpg') == 'Site photo _1_.jpg'


def test_mentions_are_found_by_full_name():
    people = [{'name': 'Chidi Eze'}, {'name': 'Ada Okafor'}]
    assert mentioned(people, '@Chidi Eze can you confirm?') == [{'name': 'Chidi Eze'}]
    assert mentioned(people, 'no one named @Chidi') == []
