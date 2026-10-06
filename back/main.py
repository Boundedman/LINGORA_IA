"""Lingora: FastAPI API and the existing interface in one deployable application."""
import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Literal
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .storage import ROOT, database, get, initialize, put, rows, storage_backend
from . import auth, learning

load_dotenv(ROOT / ".env")

@asynccontextmanager
async def lifespan(app):
    initialize()
    app.state.lessons = json.loads((ROOT / "back/curriculum.json").read_text(encoding="utf-8"))
    from .voice import retention_loop, purge_expired
    from starlette.concurrency import run_in_threadpool
    await run_in_threadpool(purge_expired)
    retention = asyncio.create_task(retention_loop())
    try:
        yield
    finally:
        retention.cancel()
        await asyncio.gather(retention, return_exceptions=True)

app = FastAPI(title="Lingora · Prototipo monolítico", lifespan=lifespan)

@app.exception_handler(HTTPException)
async def public_error(request, exc):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse({"error": "Revisa los datos enviados y su longitud."}, status_code=422)

@app.middleware("http")
async def protect(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        # The frontend proxy forwards /api with the frontend's Origin.
        # Allow only the explicitly configured public app URL, never a wildcard.
        public_origin = os.getenv('APP_URL', '').rstrip('/')
        if origin and urlparse(origin).netloc != request.headers.get("host") and origin != public_origin:
            return JSONResponse({"error": "Origen no permitido."}, status_code=403)
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"error": "Origen no permitido."}, status_code=403)
        # Bound the actual body, including requests without Content-Length.
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 3_000_000:
                return JSONResponse({"error": "Solicitud demasiado grande."}, status_code=413)
        request._body = bytes(raw)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=(self)"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path == '/' or request.url.path.startswith('/assets/'):
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response

class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class Credentials(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=256)

class Email(Input):
    email: str = Field(min_length=3, max_length=254)

class Signup(Credentials):
    display_name: str = Field(min_length=1, max_length=80)
    avatar_data: str | None = Field(default=None, max_length=2_800_000)

    @field_validator('display_name')
    @classmethod
    def nonblank_name(cls, value):
        if not value.strip():
            raise ValueError('El nombre es obligatorio')
        return value.strip()

class AvatarInput(Input):
    avatar_data: str | None = Field(max_length=2_800_000)

class Password(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    password: str = Field(min_length=10, max_length=256)
    token: str | None = Field(default=None, max_length=100)

class Profile(Input):
    display_name: str | None = Field(default=None, max_length=80)
    level: Literal['A1','A2','B1','B2','C1','C2'] | None = None
    level_source: Literal['declared','estimated'] | None = None
    interest: str | None = Field(default=None, max_length=500)
    daily_minutes: int | None = Field(default=None, ge=5, le=60)
    onboarded: bool | None = None

class Exercise(Input):
    p_lesson: str = Field(max_length=80)
    p_version: int = Field(ge=0)
    p_answer: str = Field(min_length=1, max_length=4000)

class Review(Input):
    p_id: str = Field(max_length=80)
    p_version: int = Field(ge=0)
    p_quality: Literal[0,3,4,5]

class Diagnostic(Input):
    p_version: int = Field(ge=0)
    p_active: bool
    p_key: str | None = Field(default=None, max_length=100)
    p_answer: str | None = Field(default=None, max_length=4000)
    p_finish: bool = False

class Feedback(Input):
    lesson_id: str = Field(max_length=80)
    message: str = Field(min_length=3, max_length=2000)

class Account(Input):
    action: Literal['export','clear-history','delete']
    confirmation: str | None = None

@app.get('/api/health')
def health():
    with database() as conn:
        conn.execute('SELECT 1').fetchone()
    return {"status": "ok", "storage": storage_backend()}

@app.get('/api/auth/session')
def session(request: Request):
    try:
        return {"session": {"user": auth.current_user(request)}}
    except HTTPException as exc:
        if exc.status_code != 401:
            raise
        return {"session": None}

@app.post('/api/auth/signup')
def signup(body: Signup, response: Response):
    return auth.login(body, response, signup=True)

@app.post('/api/auth/login')
def login(body: Credentials, response: Response):
    return auth.login(body, response)

@app.post('/api/auth/logout')
def logout(request: Request, response: Response):
    with database() as conn:
        session = conn.execute('SELECT user_id FROM sessions WHERE token=?', (auth.digest(request.cookies.get(auth.COOKIE, "")),)).fetchone()
        if session:
            clear_tutor_history(conn, session['user_id'])
        conn.execute("DELETE FROM sessions WHERE token=?", (auth.digest(request.cookies.get(auth.COOKIE, "")),))
    response.delete_cookie(auth.COOKIE)
    return {"ok": True}

@app.post('/api/auth/reset')
def reset(body: Email):
    return auth.reset_email(body.email)

@app.post('/api/auth/password')
def password(body: Password, request: Request, response: Response):
    user = None if body.token else auth.current_user(request)
    with database() as conn:
        if body.token:
            row = conn.execute("SELECT user_id FROM resets WHERE token=? AND expires>?", (auth.digest(body.token), time.time())).fetchone()
            if not row:
                raise HTTPException(400, "El enlace venció o ya fue utilizado.")
            user = {"id": row["user_id"]}
        uid = user["id"]
        conn.execute("UPDATE users SET password=? WHERE id=?", (auth.password_hash(body.password), uid))
        conn.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
        conn.execute("DELETE FROM resets WHERE user_id=?", (uid,))
        auth.issue_session(conn, uid, response)
    return {"ok": True}

@app.get('/api/learner')
def learner(user=Depends(auth.current_user)):
    uid = user['id']
    with database() as conn:
        avatar = get(conn, 'avatars', uid, uid)
        return dict(profile=get(conn, 'profiles', uid, uid), avatar_data=avatar['data_url'] if avatar else None, progress=rows(conn, 'lesson_progress', uid),
            reviews=sorted(rows(conn, 'reviews', uid), key=lambda r:r['next_review']),
            diagnostic=get(conn, 'diagnostics', uid, uid), lessons=app.state.lessons)

@app.post('/api/profile')
def profile(body: Profile, user=Depends(auth.current_user)):
    with database() as conn:
        value = get(conn, 'profiles', user['id'], user['id'])
        value.update(body.model_dump(exclude_none=True))
        return put(conn, 'profiles', user['id'], user['id'], value)

@app.post('/api/account/avatar')
def avatar(body: AvatarInput, user=Depends(auth.current_user)):
    from .avatars import normalize_avatar
    data = normalize_avatar(body.avatar_data)
    uid = user['id']
    with database() as conn:
        if data is None:
            conn.execute("DELETE FROM records WHERE kind='avatars' AND user_id=? AND id=?", (uid, uid))
        else:
            put(conn, 'avatars', uid, uid, {'data_url': data})
    return {'avatar_data': data}

@app.post('/api/rpc/submit_exercise')
def submit(body: Exercise, user=Depends(auth.current_user)):
    with database() as conn:
        return learning.submit(conn, user['id'], body, app.state.lessons)

@app.post('/api/rpc/rate_review')
def rate(body: Review, user=Depends(auth.current_user)):
    with database() as conn:
        return learning.rate(conn, user['id'], body)

@app.post('/api/rpc/save_diagnostic')
def diagnostic(body: Diagnostic, user=Depends(auth.current_user)):
    with database() as conn:
        return learning.diagnostic(conn, user['id'], body)

@app.get('/api/messages')
def messages(user=Depends(auth.current_user)):
    with database() as conn:
        return rows(conn, 'messages', user['id'])[-30:]

@app.post('/api/feedback')
def feedback(body: Feedback, user=Depends(auth.current_user)):
    if not any(l['id'] == body.lesson_id for l in app.state.lessons):
        raise HTTPException(404, 'Lección no disponible.')
    with database() as conn:
        put(conn, 'feedback', user['id'], str(uuid.uuid4()), body.model_dump())
    return {"ok": True}

def clear_tutor_history(conn, uid):
    conn.execute("DELETE FROM records WHERE user_id=? AND kind='messages'", (uid,))
    # Invalidate provider responses already in flight when the conversation ends.
    put(conn, 'tutor_generation', uid, uid, str(uuid.uuid4()))

@app.post('/api/account')
def account(body: Account, response: Response, user=Depends(auth.current_user)):
    uid = user['id']
    with database() as conn:
        if body.action == 'export':
            from .voice import purge
            purge(conn)
            return {kind: rows(conn, kind, uid) for kind in ['profiles','avatars','lesson_progress','reviews','diagnostics','user_errors','messages','exercise_attempts','feedback','ai_requests','voice_sessions','voice_summaries']}
        if body.action == 'clear-history':
            clear_tutor_history(conn, uid)
        elif body.confirmation == 'ELIMINAR':
            conn.execute("DELETE FROM users WHERE id=?", (uid,))
            response.delete_cookie(auth.COOKIE)
        else:
            raise HTTPException(400, 'Escribe ELIMINAR para confirmar.')
    return {"deleted": True}

from .ai import AIRequest, generate
from .voice import router as voice_router

app.include_router(voice_router)

@app.post('/api/ai')
def ai(body: AIRequest, user=Depends(auth.current_user)):
    return generate(body, user['id'], app.state.lessons)

# Register API routes first: unknown API paths must never return the SPA HTML.
@app.api_route('/api/{path:path}', methods=['GET','POST','PUT','DELETE','PATCH'])
def unknown_api(path: str):
    raise HTTPException(404, 'Ruta no disponible.')

if (ROOT / 'front/dist/assets').is_dir():
    app.mount('/assets', StaticFiles(directory=ROOT / 'front/dist/assets'), name='assets')

@app.get('/')
def index():
    if not (ROOT / 'front/dist/index.html').exists():
        raise HTTPException(503, 'Compila la interfaz con npm run build antes de iniciar.')
    return FileResponse(ROOT / 'front/dist/index.html')
