-- Ejecutar en Supabase SQL Editor con el rol postgres.
-- Compatible con back/storage.py y DATABASE_SCHEMA=lingora.
-- Conserva los datos existentes y añade display_name a versiones anteriores.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('lingora', 0));

CREATE SCHEMA IF NOT EXISTS lingora;

CREATE TABLE IF NOT EXISTS lingora.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT ''
);

-- Compatibilidad con las cuentas creadas antes de añadir el nombre explícito.
ALTER TABLE lingora.users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS lingora.sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES lingora.users(id) ON DELETE CASCADE,
    expires DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS lingora.resets (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES lingora.users(id) ON DELETE CASCADE,
    expires DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS lingora.records (
    kind TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES lingora.users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    payload TEXT NOT NULL,
    ordinal BIGINT GENERATED ALWAYS AS IDENTITY,
    PRIMARY KEY (kind, user_id, id)
);

-- El perfil es la fuente del nombre mostrado por la aplicación.
UPDATE lingora.users AS u
SET display_name = COALESCE(r.payload::jsonb ->> 'display_name', '')
FROM lingora.records AS r
WHERE r.kind = 'profiles' AND r.user_id = u.id AND r.id = u.id
  AND u.display_name IS DISTINCT FROM COALESCE(r.payload::jsonb ->> 'display_name', '');

COMMENT ON COLUMN lingora.users.password IS
    'Hash PBKDF2-SHA256 con sal; nunca contraseña en texto plano.';
COMMENT ON COLUMN lingora.users.display_name IS
    'Nombre visible, sincronizado por FastAPI al guardar el perfil.';
COMMENT ON COLUMN lingora.sessions.token IS 'Hash del token de sesión, no el token original.';
COMMENT ON COLUMN lingora.resets.token IS 'Hash del token de recuperación de un solo uso.';
COMMENT ON COLUMN lingora.records.payload IS
    'JSON serializado por FastAPI. TEXT se conserva por compatibilidad con PostgreSQL y SQLite.';
COMMENT ON TABLE lingora.records IS
    'Datos por usuario. kind: profiles (nombre, nivel, intereses, minutos diarios, onboarding), lesson_progress (paso, aciertos, intentos, finalización y versión), exercise_attempts (respuestas), reviews (repaso espaciado), diagnostics (evaluación), user_errors (errores), messages (tutor), feedback (reportes), ai_requests (cuotas y consumo), ai_cache (respuestas reutilizables). Los registros avatars previos se conservan para exportación y respaldo; la aplicación actual no los muestra.';

-- FastAPI administra el acceso. Estas tablas no tienen acceso público.
REVOKE ALL ON SCHEMA lingora FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE lingora.users, lingora.sessions,
    lingora.resets, lingora.records FROM PUBLIC, anon, authenticated;

ALTER TABLE lingora.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingora.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingora.resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingora.records ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Debe devolver las cuatro tablas.
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'lingora'
ORDER BY table_name;
