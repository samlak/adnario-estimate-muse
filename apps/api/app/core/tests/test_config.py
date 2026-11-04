from app.core.config import API, ROOT, env


def test_paths_point_into_the_repo():
    assert (ROOT / 'apps' / 'api').resolve() == API.resolve()
    assert env.RATE_CARD.name == 'rate-card' and env.SAMPLES.name == 'samples'


def test_uploads_never_live_in_the_seed():
    """Every delete is of the database or of uploaded files under DATA; the seed's samples and library are read only."""
    for seeded in (env.SAMPLES, env.RATE_CARD):
        assert not seeded.resolve().is_relative_to(env.DATA.resolve())
        assert not env.DATA.resolve().is_relative_to(seeded.resolve())
