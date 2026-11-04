"""App-wide constants: the model, the default percentages, sessions and what each role may do."""

import os

# the one model (Meta Muse Spark); it can be changed from the environment
MODEL = os.environ.get('MODEL', 'muse-spark-1.3')
MODEL_TIMEOUT = 180  # seconds, retried twice

PERCENT = {'prelims': 5.0, 'contingency': 5.0, 'vat': 7.5}  # a new estimate's prelims, contingency and VAT
DEMO_PASSWORD = 'demo-password'

COOKIE = 'adnario_session'
SESSION_DAYS = 30
RUN_KEPT_SECONDS = 600  # a finished long run is kept this long, to be followed again

PERMISSIONS = {
    'admin': {'see_estimate', 'edit_estimate', 'see_rates', 'edit_rates', 'see_programme', 'upload', 'comment',
              'create_project', 'manage_org', 'delete_project', 'all_projects', 'accept_versions', 'manage_members'},
    'qs': {'see_estimate', 'edit_estimate', 'see_rates', 'edit_rates', 'see_programme', 'upload', 'comment',
           'create_project', 'accept_versions', 'manage_members'},
    'contributor': {'see_programme', 'upload', 'comment', 'create_project'},
    'viewer': {'see_estimate', 'see_programme', 'comment'},
}
