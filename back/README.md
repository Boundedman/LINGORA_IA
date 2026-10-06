# Backend monolítico

Paquete Python `back`, servido con FastAPI. Entrega API e interfaz compilada desde `front/dist/`.

- `__init__.py`: declara el paquete Python.
- `main.py`: arranque, `.env`, catálogo, validación, endpoints, cabeceras y archivos estáticos.
- `auth.py`: registro/acceso, hashes, sesiones HttpOnly, cambio de contraseña y recuperación SMTP.
- `storage.py`: conexión PostgreSQL/SQLite, esquema privado, transacciones y registros por usuario.
- `schema.sql`: SQL completo para crear manualmente las cuatro tablas en Supabase SQL Editor con el rol postgres. FastAPI ejecuta este mismo archivo al inicializar PostgreSQL. Usa el esquema `lingora`, conserva datos existentes, añade `users.display_name` a instalaciones anteriores y recupera el nombre del perfil. Configura permisos y RLS. Otros cambios de estructura requieren migraciones explícitas.
- `learning.py`: corrección, progreso, conflictos de versión, SM-2 y diagnóstico pausable.
- `ai.py`: Gemini, política exclusiva de aprendizaje de inglés, contexto, cuotas, caché, historial y consumo; lee la clave del entorno. Valida una decisión temática y respuesta JSON antes de mostrar texto. Las consultas ajenas reciben un rechazo fijo; las respuestas inválidas del proveedor no se publican.
- `voice.py`: proxy WebSocket autenticado Gemini Live, cuotas, cierre, evaluación e historial opcional. `voice_contracts.py` valida entradas y evidencia; `voice_prompts.py` contiene los modos y escenarios. Véase [guía de voz](../docs/VOICE_TUTOR.md).
- `curriculum.json`: catálogo generado desde `front/src/data/curriculum.ts`; permite arrancar Python sin Node una vez compilado.
- `requirements.txt`: dependencias con intervalos de versión.
- `requirements.lock.txt`: versiones exactas comprobadas en el entorno Windows/Python original.
- `pytest.ini`: descubre las pruebas de este paquete y coloca la caché en `artifacts/cache/pytest`, fuera del código.
- [tests/](tests/README.md): pruebas API y persistencia.
- `__pycache__/`: bytecode generado por Python; no se edita ni se versiona.

Desde la raíz ejecuta `npm start` o `.venv\Scripts\python.exe -m uvicorn back.main:app --host 127.0.0.1 --port 8000`. Usa `npm run dev:api` para recarga y `npm run test:backend` para pruebas.

`DATABASE_URL` activa PostgreSQL; sin esa variable se usa `data/lingora.sqlite3`. Los secretos están en `.env`. Cada operación privada se limita al usuario de sesión. Las transacciones y versiones evitan duplicar respuestas. Consulta [arquitectura](../docs/ARCHITECTURE.md) y [datos](../docs/DATABASE.md).

- `avatars.py`: valida fotos de hasta 2 MB y 16 megapíxeles mediante Pillow, corrige orientación y guarda un JPEG de 256×256 sin metadatos. Solo admite JPG, PNG y WebP.

El registro requiere display_name y admite avatar_data opcional. POST /api/account/avatar actualiza la foto del usuario autenticado (null restaura el avatar predeterminado).
