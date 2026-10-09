"""Authenticated, bounded Gemini Live proxy. Content lives only during the socket.

The database holds quota leases and (only by opt-in) validated summaries. Browser
messages cannot configure a model, system policy, tools, session owner or evaluation.
"""
import asyncio
import base64
import json
import logging
import os
import re
import time
import uuid
from contextlib import suppress
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from . import auth
from .storage import database, get, put, rows
from .voice_contracts import VoiceOptions, Evaluation, validate_evaluation
from .voice_prompts import instruction, EVALUATOR

router = APIRouter(prefix='/api/voice')
ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
# Explicit allowlist verified against the Live API documentation, 2026-10-05.
MODELS = {'gemini-3.8-live', 'gemini-3.1-flash-live-preview'}
VOICES = ('Kore', 'Puck', 'Aoede')


class VoiceFailure(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message
        super().__init__(code)


def context_limits():
    trigger = max(4096, bounded('LIVE_CONTEXT_TRIGGER_TOKENS', 12000, 32000))
    target = max(2048, min(bounded('LIVE_CONTEXT_TARGET_TOKENS', 6000, 16000), trigger // 2))
    return {'triggerTokens': str(trigger), 'slidingWindow': {'targetTokens': str(target)}}
# Isolated logger: library DEBUG must never emit authentication headers or audio.
wire_logger = logging.getLogger('lingora.voice.wire')
wire_logger.addHandler(logging.NullHandler())
wire_logger.propagate = False
wire_logger.setLevel(logging.CRITICAL)


def bounded(name, default, maximum):
    try:
        return max(0, min(int(os.getenv(name, default)), maximum))
    except ValueError:
        return default


def config():
    model = os.getenv('LIVE_MODEL', 'gemini-3.8-live')
    enabled = (os.getenv('LIVE_ENABLED') == 'true' and os.getenv('AI_ENABLED') == 'true'
               and os.getenv('AI_PROVIDER', 'gemini') == 'gemini' and bool(os.getenv('AI_API_KEY'))
               and model in MODELS)
    return {'enabled': enabled, 'model': model if model in MODELS else None,
            'voices': list(VOICES), 'max_seconds': None,
            'filter_silence': os.getenv('LIVE_FILTER_SILENCE', 'true') != 'false',
            'retention_days': 30}


def purge(conn):
    now = time.time()
    # Bounded pilot metadata; physical purge is performed on voice requests.
    for record in conn.execute("SELECT kind,user_id,id,payload FROM records WHERE kind IN ('voice_sessions','voice_summaries')").fetchall():
        value = json.loads(record['payload'])
        ttl = 30 * 86400 if record['kind'] == 'voice_summaries' else 2 * 86400
        if value.get('created_at', 0) + ttl < now:
            conn.execute('DELETE FROM records WHERE kind=? AND user_id=? AND id=?',
                         (record['kind'], record['user_id'], record['id']))


def purge_expired():
    with database() as conn:
        purge(conn)


async def retention_loop():
    while True:
        await asyncio.sleep(3600)
        try:
            await run_in_threadpool(purge_expired)
        except Exception:
            # No payload or connection information in general logs.
            logging.getLogger('lingora.voice').warning('voice_retention_cleanup_failed')


@router.get('/config')
def public_config():
    return config()


@router.get('/history')
def history(user=Depends(auth.current_user)):
    with database() as conn:
        purge(conn)
        return list(reversed(rows(conn, 'voice_summaries', user['id'])))[:30]


@router.delete('/history/{sid}')
def delete_summary(sid: str, user=Depends(auth.current_user)):
    with database() as conn:
        if not get(conn, 'voice_summaries', user['id'], sid):
            raise HTTPException(404, 'Resumen no disponible.')
        conn.execute("DELETE FROM records WHERE kind='voice_summaries' AND user_id=? AND id=?", (user['id'], sid))
    return {'deleted': True}


def reserve(uid, seconds, save):
    now = time.time()
    with database() as conn:
        purge(conn)
        all_sessions = [json.loads(r[0]) for r in conn.execute("SELECT payload FROM records WHERE kind='voice_sessions'")]
        own = rows(conn, 'voice_sessions', uid)
        if any(r['expires_at'] > now and r['status'] == 'active' for r in own):
            raise HTTPException(409, 'Ya tienes una práctica de voz abierta. Finalízala antes de iniciar otra.')
        day = now - now % 86400
        if sum(r['status'] == 'active' and r['expires_at'] > now for r in all_sessions) >= bounded('LIVE_CONCURRENT_GLOBAL', 3, 10):
            raise VoiceFailure('concurrent_limit', 'Todas las plazas de voz están ocupadas. Espera a que termine una conversación y reintenta.')
        counted = lambda r: r['created_at'] >= day and (r.get('started_at') is not None
            or r.get('duration_seconds', 0) > 0 or r.get('input_bytes', 0) > 0
            or (r['status'] == 'active' and r['expires_at'] > now))
        if sum(counted(r) for r in own) >= bounded('LIVE_DAILY_SESSIONS_PER_USER', 3, 20):
            raise VoiceFailure('user_daily_limit', 'Alcanzaste la cuota diaria de inicios de voz de Lingora. Se renueva a las 18:00, hora de Ciudad de México. Puedes continuar con el tutor por texto.')
        if sum(counted(r) for r in all_sessions) >= bounded('LIVE_DAILY_SESSIONS_GLOBAL', 20, 100):
            raise VoiceFailure('global_daily_limit', 'Se alcanzó la cuota diaria de inicios de voz de Lingora para todos los usuarios. Se renueva a las 18:00, hora de Ciudad de México.')
        sid = str(uuid.uuid4())
        put(conn, 'voice_sessions', uid, sid, dict(id=sid, created_at=now,
            expires_at=now+45, status='active', save_summary=save))
    return sid


def complete(uid, sid, summary, audio_bytes, tokens, metrics=None):
    with database() as conn:
        lease = get(conn, 'voice_sessions', uid, sid)
        if not lease:  # Account deleted while connected.
            return False
        lease.update(status='finished', expires_at=time.time(), input_bytes=audio_bytes,
                     total_tokens=tokens, duration_seconds=summary['duration_seconds'])
        if metrics is not None:
            lease['metrics'] = metrics
        put(conn, 'voice_sessions', uid, sid, lease)
        if lease['save_summary']:
            put(conn, 'voice_summaries', uid, sid, dict(id=sid, created_at=time.time(), **summary))
        return lease['save_summary']


def renew(uid, sid):
    with database() as conn:
        lease = get(conn, 'voice_sessions', uid, sid)
        if not lease or lease['status'] != 'active':
            raise ValueError('Session revoked')
        lease['expires_at'] = time.time()+45
        put(conn, 'voice_sessions', uid, sid, lease)


def mark_started(uid, sid):
    with database() as conn:
        lease = get(conn, 'voice_sessions', uid, sid)
        if not lease or lease['status'] != 'active':
            raise ValueError('Session revoked')
        lease['started_at'] = time.time()
        put(conn, 'voice_sessions', uid, sid, lease)


def fallback_summary(partial=True):
    return dict(strengths=[], improvements=[], practice='Practica una presentación breve: quién eres, qué te gusta y por qué.',
                insufficient_evidence=True, partial=partial, duration_seconds=0, participation=None,
                evaluation_status='insufficient_evidence')


async def evaluate(turns, partial, duration):
    result = fallback_summary(partial)
    result['duration_seconds'] = round(duration)
    final = [t for t in turns if t['final']]
    if not any(t['role'] == 'user' and len(t['text'].strip()) >= 12 for t in final):
        return result
    if not os.getenv('AI_MODEL'):
        result['evaluation_status'] = 'unavailable'
        return result
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{quote(os.environ['AI_MODEL'], safe='')}:generateContent",
                headers={'x-goog-api-key': os.environ['AI_API_KEY']}, json={
                    'systemInstruction': {'parts': [{'text': EVALUATOR}]},
                    'contents': [{'role': 'user', 'parts': [{'text': json.dumps(final, ensure_ascii=False)}]}],
                    'generationConfig': {'responseMimeType': 'application/json',
                                         'responseJsonSchema': Evaluation.model_json_schema(), 'maxOutputTokens': 2000}})
            response.raise_for_status()
            parts = response.json()['candidates'][0]['content']['parts']
            data = json.loads(''.join(p.get('text', '') for p in parts if not p.get('thought')))
            result.update(validate_evaluation(data, final), evaluation_status='complete')
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        result['evaluation_status'] = 'unavailable'
    return result


def setup(options, model, handle=None):
    value = {'model': 'models/'+model, 'generationConfig': {'responseModalities': ['AUDIO'],
             'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': options.voice}}}},
             'systemInstruction': {'parts': [{'text': instruction(options)}]},
             'inputAudioTranscription': {}, 'outputAudioTranscription': {},
             'sessionResumption': {'handle': handle} if handle else {},
             'contextWindowCompression': context_limits(),
             'realtimeInputConfig': {'automaticActivityDetection': {'disabled': False},
                                     'turnCoverage': 'TURN_INCLUDES_ONLY_ACTIVITY'}}
    return {'setup': value}


class VoiceSession:
    def __init__(self, ws, user, options, settings, sid):
        self.ws, self.user, self.options, self.settings, self.sid = ws, user, options, settings, sid
        self.upstream = None
        self.started = time.monotonic()
        self.active_at = None
        self.partial = True
        self.connected = True
        self.stopped = False
        self.muted = False
        self.turn = 0
        self.turns = []
        self.input_bytes = 0
        self.total_tokens = 0
        self.metrics = {'usage_reports': 0, 'reported_token_sum': 0, 'peak_prompt_tokens': 0,
                        'response_token_sum': 0, 'output_bytes': 0, 'reconnections': 0,
                        'error_code': None}
        self.handle = None
        self.safe_resume = False
        self.send_lock = asyncio.Lock()
        self.client_frames = 0
        self.frame_window = time.monotonic()

    async def emit(self, event):
        async with self.send_lock:
            await asyncio.wait_for(self.ws.send_json(event), 5)

    def transcript(self, role, text):
        if not isinstance(text, str) or not text:
            return None
        ident = f'{self.turn}-{role}'
        item = next((t for t in self.turns if t['id'] == ident), None)
        if item is None:
            if len(self.turns) >= 120:
                self.turns.pop(0)
            item = dict(id=ident, role=role, text='', final=False)
            self.turns.append(item)
        # Keep a bounded rolling transcript without ending a long conversation.
        item['text'] = (item['text']+text)[-3000:]
        while len(self.turns)>1 and sum(len(t['text']) for t in self.turns)>24000:
            self.turns.pop(0)
        return {'type': 'transcript', **item}

    async def receive_browser(self):
        while True:
            message = await self.ws.receive()
            if message['type'] == 'websocket.disconnect':
                self.connected = False
                return
            now = time.monotonic()
            if now-self.frame_window >= 1:
                self.frame_window, self.client_frames = now, 0
            self.client_frames += 1
            if self.client_frames > 65:
                raise ValueError('Rate limit')
            audio = message.get('bytes')
            if audio is not None:
                if len(audio) > 6400 or not audio or len(audio) % 2:
                    raise ValueError('Invalid PCM')
                if self.muted or self.upstream is None:
                    continue
                self.input_bytes += len(audio)
                # 16kHz mono PCM16: retain real-time rate protection without a duration cutoff.
                if self.input_bytes > 32000 * (now-self.started+2):
                    raise ValueError('Audio rate limit')
                self.safe_resume = False
                await asyncio.wait_for(self.upstream.send(json.dumps({'realtimeInput': {
                    'audio': {'data': base64.b64encode(audio).decode(), 'mimeType': 'audio/pcm;rate=16000'}}})), 5)
                continue
            raw = message.get('text', '')
            if len(raw) > 200:
                raise ValueError('Control limit')
            control = json.loads(raw)
            if not isinstance(control, dict):
                raise ValueError('Invalid control')
            if control == {'type': 'finish'}:
                self.partial = False
                return
            if control == {'type': 'stop'}:
                self.partial = False
                self.stopped = True
                return
            if control == {'type': 'audio_end'}:
                if self.upstream and not self.muted:
                    await self.upstream.send(json.dumps({'realtimeInput': {'audioStreamEnd': True}}))
                continue
            if control.get('type') == 'mute' and set(control) == {'type', 'muted'} and type(control['muted']) is bool:
                self.muted = control['muted']
                if self.muted and self.upstream:
                    await self.upstream.send(json.dumps({'realtimeInput': {'audioStreamEnd': True}}))
            else:
                raise ValueError('Unknown control')

    async def provider(self):
        from websockets.asyncio.client import connect
        from websockets.exceptions import ConnectionClosed, InvalidStatus
        attempts = 0
        while True:
            try:
                async with connect(ENDPOINT, additional_headers={'x-goog-api-key': os.environ['AI_API_KEY']},
                                   open_timeout=12, close_timeout=2, max_size=512000, max_queue=4,
                                   compression=None, logger=wire_logger) as upstream:
                    await upstream.send(json.dumps(setup(self.options, self.settings['model'], self.handle)))
                    initial = json.loads(await asyncio.wait_for(upstream.recv(), 15))
                    if 'setupComplete' not in initial:
                        rejection = initial.get('error', {})
                        if rejection.get('code') == 429 or rejection.get('status') == 'RESOURCE_EXHAUSTED':
                            raise VoiceFailure('provider_quota', 'Gemini alcanzó un límite de uso. Espera antes de reintentar; consulta la cuota en Google AI Studio.')
                        raise VoiceFailure('provider_setup', 'Gemini no pudo iniciar la voz. Revisa el modelo, la clave y la configuración del servicio.')
                    self.upstream = upstream
                    if self.active_at is None:
                        await run_in_threadpool(mark_started, self.user['id'], self.sid)
                        self.active_at = time.monotonic()
                        await upstream.send(json.dumps({'clientContent': {'turns': [{'role': 'user', 'parts': [
                            {'text': 'Start our English practice with a brief greeting and one accessible question.'}]}], 'turnComplete': True}}))
                    await self.emit({'type': 'ready', 'id': self.sid, 'max_seconds': self.settings['max_seconds'], 'resumed': self.metrics['reconnections'] > 0})
                    attempts = 0  # Bound consecutive failures, not the lifetime of a conversation.
                    async for raw in upstream:
                        event = json.loads(raw)
                        update = event.get('sessionResumptionUpdate')
                        if update is not None:
                            self.handle = update.get('newHandle') if update.get('resumable') else None
                        usage = event.get('usageMetadata', {})
                        if usage:
                            counts = {k: max(0, int(usage.get(k, 0))) for k in ('totalTokenCount', 'promptTokenCount', 'responseTokenCount')}
                            self.total_tokens = max(self.total_tokens, counts['totalTokenCount'])
                            self.metrics['usage_reports'] += 1
                            self.metrics['reported_token_sum'] += counts['totalTokenCount']
                            self.metrics['peak_prompt_tokens'] = max(self.metrics['peak_prompt_tokens'], counts['promptTokenCount'])
                            self.metrics['response_token_sum'] += counts['responseTokenCount']
                        if 'error' in event:
                            code = event['error'].get('code')
                            if code == 429 or event['error'].get('status') == 'RESOURCE_EXHAUSTED':
                                raise VoiceFailure('provider_quota', 'Gemini alcanzó un límite de uso. Espera antes de reintentar; el administrador puede consultar la cuota en Google AI Studio.')
                            raise VoiceFailure('provider_error', 'Gemini no pudo continuar la conversación. El micrófono está apagado. Puedes reintentar.')
                        if 'goAway' in event:
                            break
                        content = event.get('serverContent', {})
                        if content.get('interrupted'):
                            await self.emit({'type': 'interrupted', 'turn': self.turn})
                        for role, key in [('user', 'inputTranscription'), ('assistant', 'outputTranscription')]:
                            transcript = self.transcript(role, content.get(key, {}).get('text', ''))
                            if transcript:
                                await self.emit(transcript)
                        if not content.get('interrupted'):
                            for part in content.get('modelTurn', {}).get('parts', []):
                                audio = part.get('inlineData', {})
                                if part.get('thought') or not audio:
                                    continue
                                if not re.fullmatch(r'audio/pcm(?:;rate=24000)?', audio.get('mimeType', '')):
                                    raise ValueError('Unsupported audio')
                                chunk = base64.b64decode(audio['data'], validate=True)
                                if len(chunk) > 240000 or len(chunk) % 2:
                                    raise ValueError('Audio limit')
                                self.safe_resume = False
                                self.metrics['output_bytes'] += len(chunk)
                                await self.emit({'type': 'audio', 'data': audio['data'], 'turn': self.turn})
                        if content.get('turnComplete'):
                            for item in self.turns:
                                if not item['final']:
                                    item['final'] = True
                                    await self.emit({'type': 'transcript', **item})
                            await self.emit({'type': 'turn_complete', 'turn': self.turn})
                            self.turn += 1
                            self.safe_resume = True
                    self.upstream = None
            except InvalidStatus as exc:
                # Authentication, model and quota rejections are not retried.
                if exc.response.status_code == 429:
                    raise VoiceFailure('provider_quota', 'Gemini alcanzó un límite de uso. Espera antes de reintentar; consulta la cuota en Google AI Studio.') from None
                raise VoiceFailure('provider_setup', 'Gemini rechazó la conexión de voz. Revisa la configuración del servicio.') from None
            except (ConnectionClosed, OSError, TimeoutError):
                self.upstream = None
            attempts += 1
            if attempts > 2 or (self.active_at is not None and not (self.handle and self.safe_resume)):
                raise VoiceFailure('provider_connection', 'Se perdió la conexión con Gemini. El micrófono está apagado. Puedes reintentar.')
            self.metrics['reconnections'] += 1
            self.muted = True
            await self.emit({'type': 'reconnecting', 'attempt': attempts})
            await asyncio.sleep(attempts)

    async def watchdog(self):
        while True:
            await asyncio.sleep(10)
            # Session revocation/logout/account deletion also closes existing sockets.
            await run_in_threadpool(auth.current_user, self.ws)
            await run_in_threadpool(renew, self.user['id'], self.sid)

    async def run(self):
        tasks = [asyncio.create_task(fn()) for fn in (self.receive_browser, self.provider, self.watchdog)]
        try:
            done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                task.result()
        except Exception as exc:
            self.partial = True
            code = exc.code if isinstance(exc, VoiceFailure) else 'session_error'
            self.metrics['error_code'] = code
            logging.getLogger('lingora.voice').warning('voice_session_error code=%s', code)
            with suppress(Exception):
                await self.emit({'type': 'error', 'code': code, 'message': exc.message if isinstance(exc, VoiceFailure) else 'Se interrumpió la conexión de voz. El micrófono está apagado. Puedes reintentar.'})
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            self.upstream = None
            duration = max(0, time.monotonic()-(self.active_at or time.monotonic()))
            logging.getLogger('lingora.voice').info(
                'voice_session_metrics duration_seconds=%s input_bytes=%s metrics=%s',
                round(duration), self.input_bytes, json.dumps(self.metrics, sort_keys=True))
            if self.stopped or not self.connected or self.partial:
                # A stopped/disconnected session must never start further model work.
                summary = fallback_summary(self.partial)
                summary['duration_seconds'] = round(duration)
                await run_in_threadpool(complete, self.user['id'], self.sid, summary, self.input_bytes, self.total_tokens, self.metrics)
                self.turns.clear()
                with suppress(Exception):
                    await self.ws.close(code=1000 if self.stopped else 1011)
            else:
                with suppress(Exception):
                    await self.emit({'type': 'finishing'})
                try:
                    summary = await asyncio.wait_for(evaluate(self.turns, self.partial, duration), 18)
                except (Exception, asyncio.CancelledError):
                    summary = fallback_summary(True)
                    summary['duration_seconds'] = round(duration)
                saved = await run_in_threadpool(complete, self.user['id'], self.sid, summary, self.input_bytes, self.total_tokens, self.metrics)
                self.turns.clear()
                with suppress(Exception):
                    await self.emit({'type': 'summary', 'summary': summary, 'saved': saved})
                    await self.ws.close(code=1000)


@router.websocket('/live')
async def live(ws: WebSocket):
    # HTTP middleware does not cover WebSockets. Require an exact, non-null origin.
    origin = ws.headers.get('origin', '')
    public = os.getenv('APP_URL', '').rstrip('/')
    local = origin in ('http://127.0.0.1:8000', 'http://localhost:8000', 'http://127.0.0.1:5173', 'http://localhost:5173')
    allowed = bool(origin and (origin == public or (os.getenv('COOKIE_SECURE') != 'true' and local)))
    if not allowed or ws.headers.get('sec-fetch-site') == 'cross-site':
        await ws.close(code=1008)
        return
    try:
        user = await run_in_threadpool(auth.current_user, ws)
    except HTTPException:
        await ws.close(code=1008)
        return
    await ws.accept()
    try:
        settings = config()
        if not settings['enabled']:
            raise HTTPException(503, 'La práctica de voz aún no está habilitada.')
        raw = await asyncio.wait_for(ws.receive_text(), 10)
        if len(raw) > 2000:
            raise ValueError('Options limit')
        options = VoiceOptions.model_validate_json(raw)
        if options.voice not in VOICES:
            raise ValueError('Voice not allowed')
        sid = await run_in_threadpool(reserve, user['id'], settings['max_seconds'], options.save_summary)
    except (HTTPException, VoiceFailure, ValidationError, ValueError, TimeoutError, WebSocketDisconnect) as exc:
        with suppress(Exception):
            await ws.send_json({'type': 'error', 'code': exc.code if isinstance(exc, VoiceFailure) else 'start_error',
                                'message': exc.message if isinstance(exc, VoiceFailure) else exc.detail if isinstance(exc, HTTPException) else 'No se pudo iniciar. Revisa las opciones y vuelve a intentarlo.'})
            await ws.close(code=1008)
        return
    await VoiceSession(ws, user, options, settings, sid).run()
