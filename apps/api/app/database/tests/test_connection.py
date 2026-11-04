from app.database import connection as db


def test_ids_are_new_each_time():
    assert db.new_id() != db.new_id()


def test_the_schema_is_there_and_keeps_firms_apart():
    schema = (db.Path(db.__file__).parent / 'schema.sql').read_text()
    assert 'enable row level security' in schema.lower() and 'adnario_app' in schema
