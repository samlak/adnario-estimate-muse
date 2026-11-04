from app.core.config import API, ROOT, env


def test_paths_point_into_the_repo():
    assert (ROOT / 'apps' / 'api').resolve() == API.resolve()
    assert env.RATE_CARD.name == 'rate-card' and env.SAMPLES.name == 'samples'
