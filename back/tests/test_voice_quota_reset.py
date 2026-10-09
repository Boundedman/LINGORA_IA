import time

import pytest

from back.tests.test_app import client, signup
from back.storage import database, put, rows
from scripts.reset_voice_quotas import reset_voice_quotas


def test_reset_clears_only_quota_metadata_and_preserves_summaries_and_progress(client):
    uid = signup(client)
    with database() as conn:
        put(conn, 'voice_sessions', uid, 'finished', {'created_at': time.time(), 'status': 'finished', 'expires_at': time.time()-1})
        put(conn, 'voice_sessions', uid, 'expired', {'created_at': time.time(), 'status': 'active', 'expires_at': time.time()-1})
        put(conn, 'voice_summaries', uid, 'summary', {'practice': 'Keep practising'})
        put(conn, 'lesson_progress', uid, 'lesson', {'completed': True})
    assert reset_voice_quotas()['quota_records'] == 2
    with database() as conn:
        assert len(rows(conn, 'voice_sessions', uid)) == 2
    result = reset_voice_quotas(apply=True)
    assert result['reset'] and result['remaining_records'] == 0
    with database() as conn:
        assert not rows(conn, 'voice_sessions', uid)
        assert rows(conn, 'voice_summaries', uid) == [{'practice': 'Keep practising'}]
        assert rows(conn, 'lesson_progress', uid) == [{'completed': True}]
        assert conn.execute('SELECT count(*) FROM users').fetchone()[0] == 1
    assert reset_voice_quotas(apply=True)['quota_records'] == 0


def test_reset_refuses_active_sessions_without_partial_deletion(client):
    uid = signup(client)
    with database() as conn:
        put(conn, 'voice_sessions', uid, 'finished', {'status': 'finished', 'expires_at': 0})
        put(conn, 'voice_sessions', uid, 'active', {'status': 'active', 'expires_at': time.time()+45})
    with pytest.raises(RuntimeError, match='activas'):
        reset_voice_quotas(apply=True)
    with database() as conn:
        assert len(rows(conn, 'voice_sessions', uid)) == 2
