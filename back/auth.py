import hashlib
import hmac
import os
import secrets
import smtplib
import time
import uuid
from email.message import EmailMessage
from fastapi import HTTPException, Request, Response
from .storage import database, put

COOKIE = "lingora_session"

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600_000).hex()
    return salt + ":" + hashed

def current_user(request: Request):
    token = request.cookies.get(COOKIE, "")
    with database() as conn:
        row = conn.execute("SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
                           (digest(token), time.time())).fetchone()
    if not row:
        raise HTTPException(401, "Inicia sesión para continuar.")
    return dict(row)

def issue_session(conn, uid, response):
    token = secrets.token_urlsafe(32)
    conn.execute("DELETE FROM sessions WHERE expires<=?", (time.time(),))
    conn.execute("INSERT INTO sessions VALUES(?,?,?)", (digest(token), uid, time.time()+7*86400))
    response.set_cookie(COOKIE, token, httponly=True, samesite="strict", max_age=7*86400,
                        secure=os.getenv("COOKIE_SECURE", "false") == "true")

def login(body, response: Response, signup=False):
    email = body.email.strip().lower()
    if "@" not in email or len(email) > 254:
        raise HTTPException(422, "Correo inválido.")
    with database() as conn:
        row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if signup:
            invites = [e.strip().lower() for e in os.getenv("PILOT_INVITES", "").split(",") if e.strip()]
            if (invites and email not in invites) or row:
                raise HTTPException(400, "No se pudo crear la cuenta. Revisa el correo y la invitación.")
            uid = str(uuid.uuid4())
            conn.execute("INSERT INTO users (id,email,password) VALUES(?,?,?)", (uid, email, password_hash(body.password)))
            put(conn, "profiles", uid, uid, dict(id=uid, display_name=body.display_name, level="A1", level_source="declared",
                interest="", daily_minutes=15, onboarded=False))
        else:
            # Equal-cost hashing for unknown users as well.
            stored = row["password"] if row else "00"*16 + ":" + "00"*32
            if not hmac.compare_digest(password_hash(body.password, stored.split(":")[0]), stored) or not row:
                raise HTTPException(401, "Correo o contraseña incorrectos.")
            uid = row["id"]
        issue_session(conn, uid, response)
    return {"session": {"user": {"id": uid, "email": email}}}

def reset_email(email):
    if not os.getenv("SMTP_HOST") or not os.getenv("SMTP_FROM"):
        raise HTTPException(503, "El correo de recuperación aún no está configurado. Contacta al administrador del prototipo.")
    with database() as conn:
        row = conn.execute("SELECT id FROM users WHERE email=?", (email.strip().lower(),)).fetchone()
        if not row:
            return {"ok": True}
        token = secrets.token_urlsafe(32)
        conn.execute("DELETE FROM resets WHERE user_id=? OR expires<=?", (row["id"], time.time()))
        conn.execute("INSERT INTO resets VALUES(?,?,?)", (digest(token), row["id"], time.time()+1800))
    message = EmailMessage()
    message["From"], message["To"], message["Subject"] = os.environ["SMTP_FROM"], email, "Recupera tu acceso a Lingora"
    base = os.getenv("APP_URL", "http://127.0.0.1:8000").rstrip("/")
    message.set_content(f"Abre este enlace para cambiar tu contraseña (vence en 30 minutos):\n{base}/#reset={token}")
    try:
        with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587")), timeout=15) as smtp:
            smtp.starttls()
            if os.getenv("SMTP_USER"):
                smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        raise HTTPException(503, "No se pudo enviar el correo. Inténtalo más tarde.")
    return {"ok": True}
