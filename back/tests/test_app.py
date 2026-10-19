import time
import os
import json
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from back.main import app
from back.storage import database, get, put, initialize
from back import auth

@pytest.fixture
def client(tmp_path, monkeypatch):
    # Never run tests against the configured application database.
    monkeypatch.delenv('DATABASE_URL', raising=False)
    if os.getenv('TEST_DATABASE_URL'):
        import uuid
        monkeypatch.setenv('DATABASE_URL', os.environ['TEST_DATABASE_URL'])
        monkeypatch.setenv('DATABASE_SCHEMA', 'lingora_test_' + uuid.uuid4().hex)
    monkeypatch.setenv('DATABASE_PATH', str(tmp_path / 'test.sqlite3'))
    monkeypatch.setenv('PILOT_INVITES', '')
    monkeypatch.setenv('AI_ENABLED', 'false')
    monkeypatch.setenv('COOKIE_SECURE', 'false')
    with TestClient(app) as client:
        yield client
    if os.getenv('TEST_DATABASE_URL'):
        import psycopg
        from psycopg import sql
        with psycopg.connect(os.environ['TEST_DATABASE_URL'], sslmode='require') as conn:
            conn.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(os.environ['DATABASE_SCHEMA'])))

def signup(client, email='first@example.com'):
    response = client.post('/api/auth/signup', json={'display_name':'Estudiante','email':email,'password':'safe-password-123'})
    assert response.status_code == 200, response.text
    assert 'HttpOnly' in response.headers['set-cookie']
    return response.json()['session']['user']['id']

def test_auth_profile_isolation_and_delete(client):
    assert client.get('/api/learner').status_code == 401
    uid = signup(client)
    assert client.post('/api/profile', json={'display_name':'Ana','level':'B1'}).status_code == 200
    with database() as conn:
        account = conn.execute('SELECT display_name,email,password FROM users WHERE id=?', (uid,)).fetchone()
        assert account['display_name'] == 'Ana'
        assert account['email'] == 'first@example.com'
        assert account['password'] != 'safe-password-123'
        assert auth.password_hash('safe-password-123', account['password'].split(':')[0]) == account['password']
    cookie = client.cookies.get(auth.COOKIE)
    client.post('/api/auth/logout', json={})
    assert client.get('/api/auth/session').json()['session'] is None
    signup(client, 'second@example.com')
    assert client.get('/api/learner').json()['profile']['display_name'] == 'Estudiante'
    assert client.post('/api/profile',json={'id':uid}).status_code == 422
    client.cookies.clear()
    client.cookies.set(auth.COOKIE,cookie)
    assert client.get('/api/learner').status_code == 401
    assert client.post('/api/auth/login',json={'email':'first@example.com','password':'safe-password-123'}).status_code == 200
    assert client.get('/api/learner').json()['profile']['display_name'] == 'Ana'
    assert client.post('/api/profile', json={'display_name':''}).status_code == 200
    with database() as conn:
        assert conn.execute('SELECT display_name FROM users WHERE id=?', (uid,)).fetchone()[0] == ''
    assert client.post('/api/account',json={'action':'delete'}).status_code == 400
    assert client.post('/api/account',json={'action':'delete','confirmation':'ELIMINAR'}).status_code == 200
    assert client.get('/api/learner').status_code == 401
    with database() as conn:
        assert not conn.execute('SELECT 1 FROM records WHERE user_id=?',(uid,)).fetchone()


def test_upgrade_preserves_existing_accounts_and_progress(client):
    uid = signup(client)
    assert client.post('/api/profile', json={'display_name':'María','level':'B2'}).status_code == 200
    with database() as conn:
        password_before = conn.execute('SELECT password FROM users WHERE id=?', (uid,)).fetchone()[0]
        put(conn, 'lesson_progress', uid, 'existing-lesson', {'step':3,'completed':False,'version':3})
        # Reproduce the previous schema, whose name lived only in profiles.
        conn.execute('ALTER TABLE users DROP COLUMN display_name')
    initialize()
    initialize()
    with database() as conn:
        account = conn.execute('SELECT display_name,password FROM users WHERE id=?', (uid,)).fetchone()
        assert account['display_name'] == 'María'
        assert account['password'] == password_before
        assert get(conn, 'lesson_progress', uid, 'existing-lesson')['version'] == 3
    assert client.get('/api/learner').json()['profile']['level'] == 'B2'
    with pytest.raises(RuntimeError):
        with database() as conn:
            put(conn, 'profiles', uid, uid, {'display_name':'Rolled back'})
            raise RuntimeError('rollback both profile and account')
    with database() as conn:
        assert conn.execute('SELECT display_name FROM users WHERE id=?', (uid,)).fetchone()[0] == 'María'
        assert get(conn, 'profiles', uid, uid)['display_name'] == 'María'


def test_signup_rejects_legacy_photo_and_preserves_existing_avatar_records(client):
    credentials = {'email':'photo@example.com','password':'safe-password-123'}
    assert client.post('/api/auth/signup',json=credentials).status_code == 422
    assert client.post('/api/auth/signup',json={**credentials,'display_name':'   '}).status_code == 422
    response = client.post('/api/auth/signup',json={**credentials,'display_name':'Ana'})
    assert response.status_code == 200
    uid = response.json()['session']['user']['id']
    assert 'avatar_data' not in client.get('/api/learner').json()
    assert client.post('/api/account/avatar',json={'avatar_data':None}).status_code == 404
    with database() as conn:
        put(conn,'avatars',uid,uid,{'data_url':'data:image/jpeg;base64,legacy'})
    exported = client.post('/api/account',json={'action':'export'}).json()
    assert exported['avatars'][0]['data_url'] == 'data:image/jpeg;base64,legacy'
    assert client.post('/api/account',json={'action':'delete','confirmation':'ELIMINAR'}).status_code == 200
    with database() as conn:
        assert not conn.execute("SELECT 1 FROM records WHERE kind='avatars' AND user_id=?",(uid,)).fetchone()

def test_lesson_conflicts_reviews_and_export(client):
    signup(client)
    lesson = client.get('/api/learner').json()['lessons'][0]
    body = {'p_lesson':lesson['id'],'p_version':0,'p_answer':lesson['exercises'][0]['answer']}
    assert client.post('/api/rpc/submit_exercise',json=body).json()['correct'] is True
    assert client.post('/api/rpc/submit_exercise',json=body).status_code == 409
    for i,e in enumerate(lesson['exercises'][1:],1):
        assert client.post('/api/rpc/submit_exercise',json={**body,'p_version':i,'p_answer':e.get('answer','practice')}).status_code == 200
    state = client.get('/api/learner').json()
    assert state['progress'][0]['completed']
    assert state['reviews']
    review=state['reviews'][0]
    rating={'p_id':review['id'],'p_version':0,'p_quality':4}
    assert client.post('/api/rpc/rate_review',json=rating).json()['interval_days']==1
    assert client.post('/api/rpc/rate_review',json=rating).status_code==409
    exported=client.post('/api/account',json={'action':'export'}).json()
    assert len(exported['exercise_attempts'])==len(lesson['exercises'])

def test_diagnostic_time_pause_and_conflict(client):
    uid=signup(client)
    body={'p_version':0,'p_active':True}
    d=client.post('/api/rpc/save_diagnostic',json=body).json()
    with database() as conn:
        d['updated_at']='2020-01-01T00:00:00+00:00'
        put(conn,'diagnostics',uid,uid,d)
    d=client.post('/api/rpc/save_diagnostic',json={'p_version':1,'p_active':False,'p_key':'writing','p_answer':'Hello'}).json()
    assert d['elapsed_seconds']==45
    assert not d['active']
    assert d['answers']['writing']=='Hello'
    assert client.post('/api/rpc/save_diagnostic',json=body).status_code==409
    with database() as conn:
        d.update(elapsed_seconds=895,active=True,updated_at='2020-01-01T00:00:00+00:00')
        put(conn,'diagnostics',uid,uid,d)
    d=client.post('/api/rpc/save_diagnostic',json={'p_version':2,'p_active':True}).json()
    assert d['elapsed_seconds']==900 and d['completed'] and not d['active']

def test_reset_token_single_use_and_session_revocation(client):
    uid=signup(client)
    old=client.cookies.get(auth.COOKIE)
    with database() as conn:
        conn.execute('INSERT INTO resets VALUES(?,?,?)',(auth.digest('test-token'),uid,time.time()+60))
    client.post('/api/auth/logout',json={})
    body={'password':'new-password-456','token':'test-token'}
    assert client.post('/api/auth/password',json=body).status_code==200
    assert client.post('/api/auth/password',json=body).status_code==400
    client.cookies.clear()
    client.cookies.set(auth.COOKIE,old)
    assert client.get('/api/learner').status_code==401
    assert client.post('/api/auth/login',json={'email':'first@example.com','password':'new-password-456'}).status_code==200

def test_routes_validation_and_csrf(client):
    assert client.get('/').status_code==200
    assert client.get('/api/unknown').status_code==404
    assert client.post('/api/auth/signup',json={'email':'a@b.c','password':'too-short'}).status_code==422
    assert client.post('/api/auth/logout',json={},headers={'Origin':'https://evil.example'}).status_code==403
    signup(client)
    assert client.post('/api/ai',json={'operation':'tutor','message':'Hello'}).status_code==503
    assert client.post('/api/ai',json={'operation':'audio','message':'Hello'}).status_code==422
    assert client.post('/api/ai',content=b'x'*3_000_001).status_code==413

def test_netlify_proxy_accepts_only_configured_public_origin(client, monkeypatch):
    monkeypatch.setenv('APP_URL', 'https://lingora.example/')
    allowed = {'Origin':'https://lingora.example', 'Sec-Fetch-Site':'same-origin'}
    response = client.post('/api/auth/signup', json={
        'display_name':'Ana', 'email':'proxy@example.com', 'password':'safe-password-123'
    }, headers=allowed)
    assert response.status_code == 200
    assert client.post('/api/profile', json={'display_name':'Ana proxy'}, headers=allowed).status_code == 200
    for origin in ['https://evil.example', 'https://lingora.example.evil.test', 'http://lingora.example']:
        assert client.post('/api/auth/logout', json={}, headers={'Origin':origin}).status_code == 403
    assert client.post('/api/auth/logout', json={}, headers={**allowed, 'Sec-Fetch-Site':'cross-site'}).status_code == 403
    assert client.post('/api/auth/logout', json={}, headers=allowed).status_code == 200


def test_invites_password_spaces_and_smtp_configuration(client,monkeypatch):
    monkeypatch.setenv('PILOT_INVITES','invited@example.com')
    credentials={'email':'other@example.com','password':'  password-123  '}
    assert client.post('/api/auth/signup',json={**credentials,'display_name':'Invitado'}).status_code==400
    credentials['email']='invited@example.com'
    assert client.post('/api/auth/signup',json={**credentials,'display_name':'Invitado'}).status_code==200
    client.post('/api/auth/logout',json={})
    assert client.post('/api/auth/login',json={**credentials,'password':credentials['password'].strip()}).status_code==401
    assert client.post('/api/auth/login',json=credentials).status_code==200
    monkeypatch.delenv('SMTP_HOST',raising=False)
    assert client.post('/api/auth/reset',json={'email':credentials['email']}).status_code==503

def test_ai_history_cache_and_quota(client,monkeypatch):
    import httpx
    import back.ai as ai
    signup(client)
    monkeypatch.setenv('AI_ENABLED','true')
    monkeypatch.setenv('AI_API_KEY','test-key')
    monkeypatch.setenv('AI_MODEL','test-model')
    monkeypatch.setenv('AI_DAILY_CALLS_PER_USER','3')
    monkeypatch.setenv('AI_MAX_CALLS_PER_MINUTE','10')
    def provider(*args,**kwargs):
        return httpx.Response(200,json={'candidates':[{'content':{'parts':[{'text':'{"in_scope":true,"text":"Good practice!"}'}]}}],'usageMetadata':{'promptTokenCount':20,'candidatesTokenCount':4}},request=httpx.Request('POST','https://example.com'))
    monkeypatch.setattr(ai.httpx,'post',provider)
    assert client.post('/api/ai',json={'operation':'tutor','message':'Hello'}).status_code==200
    assert len(client.get('/api/messages').json())==2
    body={'operation':'explain','message':'Explain hello'}
    assert client.post('/api/ai',json=body).json()['cached'] is False
    assert client.post('/api/ai',json=body).json()['cached'] is True
    assert client.post('/api/ai',json=body).status_code==429
    assert client.post('/api/account',json={'action':'clear-history'}).status_code==200
    assert client.get('/api/messages').json()==[]

def test_concurrent_exercise_is_applied_once(client):
    signup(client)
    body={'p_lesson':app.state.lessons[0]['id'],'p_version':0,'p_answer':'wrong'}
    cookie=client.cookies.get(auth.COOKIE)
    def submit(_):
        with TestClient(app) as other:
            other.cookies.set(auth.COOKIE,cookie)
            return other.post('/api/rpc/submit_exercise',json=body).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(submit,range(2)))==[200,409]
    assert len(client.post('/api/account',json={'action':'export'}).json()['exercise_attempts'])==1

@pytest.mark.parametrize('operation', ['tutor', 'writing', 'explain', 'audio'])
def test_off_topic_response_is_replaced_for_every_operation(client, monkeypatch, operation):
    import httpx
    import back.ai as ai
    uid = signup(client)
    monkeypatch.setenv('AI_ENABLED', 'true')
    monkeypatch.setenv('AI_API_KEY', 'test-key')
    monkeypatch.setenv('AI_MODEL', 'test-model')
    def provider(*args, **kwargs):
        config = kwargs['json']['generationConfig']
        assert config['responseMimeType'] == 'application/json'
        assert 'in_scope' in config['responseSchema']['required']
        # Even if the model includes an answer alongside a refusal decision, discard it.
        output = json.dumps({'in_scope': False, 'text': 'Unrelated answer must not reach the learner'})
        return httpx.Response(200, json={'candidates':[{'content':{'parts':[{'text':output}]}}]},
                              request=httpx.Request('POST', 'https://example.com'))
    monkeypatch.setattr(ai.httpx, 'post', provider)
    body = {'operation':operation, 'message':'Write a Python program', 'lessonId':'a1-grammar'}
    if operation == 'audio':
        body['audio'] = {'data':'dGVzdA==', 'mime':'audio/webm'}
    response = client.post('/api/ai', json=body)
    assert response.status_code == 200
    assert response.json()['text'] == ai.OFF_TOPIC_REPLY
    with database() as conn:
        from back.storage import rows
        assert rows(conn, 'ai_requests', uid)[0]['status'] == 'off_topic'
        assert rows(conn, 'ai_cache', uid) == []
    if operation == 'tutor':
        assert client.get('/api/messages').json()[-1]['content'] == ai.OFF_TOPIC_REPLY

@pytest.mark.parametrize('raw', [None, '', 'plain unrelated answer', '{"in_scope":"true","text":"answer"}',
                               '{"text":"answer"}', '{"in_scope":true,"text":""}',
                               '{"in_scope":true,"text":"unfinished'])
def test_malformed_provider_output_is_not_exposed(client, monkeypatch, raw):
    import httpx
    import back.ai as ai
    signup(client)
    monkeypatch.setenv('AI_ENABLED', 'true')
    monkeypatch.setenv('AI_API_KEY', 'test-key')
    monkeypatch.setenv('AI_MODEL', 'test-model')
    monkeypatch.setattr(ai.httpx, 'post', lambda *args, **kwargs: httpx.Response(200,
        json={'candidates':[] if raw is None else [{'content':{'parts':[{'text':raw}]}}]},
        request=httpx.Request('POST','https://example.com')))
    client.post('/api/profile', json={'interest':'Tecnología y videojuegos'})
    response = client.post('/api/ai', json={'operation':'tutor','message':'Ahora hazme un código en Python'})
    assert response.status_code == 200
    assert response.json()['text'] == ai.UNVERIFIED_REPLY
    assert client.get('/api/messages').json()[-1]['content'] == ai.UNVERIFIED_REPLY


def test_provider_connection_failure_keeps_its_error(client, monkeypatch):
    import httpx
    import back.ai as ai
    signup(client)
    monkeypatch.setenv('AI_ENABLED', 'true')
    monkeypatch.setenv('AI_API_KEY', 'test-key')
    monkeypatch.setenv('AI_MODEL', 'test-model')
    def unavailable(*args, **kwargs):
        raise httpx.ConnectError('unavailable')
    monkeypatch.setattr(ai.httpx, 'post', unavailable)
    response = client.post('/api/ai', json={'operation':'tutor','message':'Explícame el presente simple'})
    assert response.status_code == 503
    assert 'No pudimos contactar' in response.json()['error']
    assert client.get('/api/messages').json() == []

def test_previous_policy_cache_is_not_returned(client, monkeypatch):
    import hashlib
    import httpx
    import back.ai as ai
    uid = signup(client)
    monkeypatch.setenv('AI_ENABLED','true')
    monkeypatch.setenv('AI_API_KEY','test-key')
    monkeypatch.setenv('AI_MODEL','test-model')
    message = 'Give me a recipe in English'
    old_key = hashlib.sha256(json.dumps([uid,'test-model','v1',message,None,'A1'],ensure_ascii=False).encode()).hexdigest()
    with database() as conn:
        put(conn,'ai_cache',uid,old_key,{'response':'Old unrestricted recipe','expires_at':time.time()+1000})
    monkeypatch.setattr(ai.httpx,'post',lambda *args,**kwargs:httpx.Response(200,
        json={'candidates':[{'content':{'parts':[{'text':'{"in_scope":false,"text":""}'}]}}]},
        request=httpx.Request('POST','https://example.com')))
    response=client.post('/api/ai',json={'operation':'explain','message':message})
    assert response.json()=={'text':ai.OFF_TOPIC_REPLY,'cached':False}

def test_logout_clears_tutor_history_only(client):
    uid = signup(client)
    with database() as conn:
        put(conn, 'messages', uid, 'old', {'role':'user','content':'Hello'})
    before = client.get('/api/learner').json()
    assert client.post('/api/auth/logout', json={}).status_code == 200
    assert client.post('/api/auth/login', json={'email':'first@example.com','password':'safe-password-123'}).status_code == 200
    assert client.get('/api/messages').json() == []
    assert client.get('/api/learner').json() == before


def test_reset_discards_pending_tutor_response(client, monkeypatch):
    import httpx
    import back.ai as ai
    signup(client)
    monkeypatch.setenv('AI_ENABLED', 'true')
    monkeypatch.setenv('AI_API_KEY', 'test-key')
    monkeypatch.setenv('AI_MODEL', 'test-model')
    def provider(*args, **kwargs):
        assert client.post('/api/account', json={'action':'clear-history'}).status_code == 200
        return httpx.Response(200, json={'candidates':[{'content':{'parts':[{'text':'{"in_scope":true,"text":"Hello!"}'}]}}]}, request=httpx.Request('POST','https://example.com'))
    monkeypatch.setattr(ai.httpx, 'post', provider)
    assert client.post('/api/ai', json={'operation':'tutor','message':'Hello'}).status_code == 200
    assert client.get('/api/messages').json() == []
