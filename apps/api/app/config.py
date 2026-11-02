"""Settings, from the environment and the repo root's .env (README §11)."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # the repo
API = Path(__file__).resolve().parents[1]


def _load_env() -> None:
    env = ROOT / '.env'
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()


class env:
    DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://adnario:adnario@localhost:55622/adnario')
    MUSE_API_KEY = os.environ.get('MUSE_API_KEY', '')
    CONVERTER_URL = os.environ.get('CONVERTER_URL', 'http://localhost:8100')
    FILES = Path(os.environ.get('FILES_DIR', API / 'files'))
    WEB_DIST = Path(os.environ.get('WEB_DIST', ROOT / 'apps' / 'web' / 'dist'))
    DEMO = os.environ.get('DEMO', '1') == '1'  # the sign-in page's demo accounts, and the demo seed
    SAMPLES = Path(os.environ.get('SAMPLES_DIR', ROOT / 'overview' / 'samples'))
    RATE_CARD = Path(os.environ.get('RATE_CARD_DIR', ROOT / 'overview' / 'rate-card'))


MUSE_BASE_URL = os.environ.get('MUSE_BASE_URL', 'https://api.meta.ai/v1')
MODEL_FAST = os.environ.get('MODEL_FAST', 'muse-spark-1.3')
MODEL_SMART = os.environ.get('MODEL_SMART', 'muse-spark-1.3')
MODEL_TIMEOUT = 180  # seconds, retried twice
PERCENT = {'prelims': 5.0, 'contingency': 5.0, 'vat': 7.5}
DEMO_PASSWORD = 'demo-password'
