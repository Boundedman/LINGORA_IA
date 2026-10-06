# Herramientas comunes

- `check_supabase.py`: comprueba la conexión PostgreSQL con `DATABASE_URL` del `.env` raíz, exige SSL y consulta únicamente metadatos en una transacción de lectura. No imprime credenciales ni modifica tablas. Ejecutar `node scripts/python.mjs scripts/check_supabase.py`; devuelve código 0 si conecta y 1 si falla. Requiere las dependencias de `back/requirements.lock.txt`. Esta comprobación no cambia el almacenamiento vigente de SQLite ni migra datos.

- `export-curriculum.ts`: importa `front/src/data/curriculum.ts` y escribe `back/curriculum.json`; forma parte de `npm run build`.
- `python.mjs`: elige `.venv/Scripts/python.exe` en Windows o `.venv/bin/python` en Linux/macOS, transmite argumentos, salida y señales. Lo usan los comandos de servidor y pruebas Python.
- `check_live.py`: consulta modelos Gemini con la clave privada; `--handshake` genera una frase y `--sample` verifica PCM bidireccional con la muestra pública oficial. Estas opciones consumen cuota; no usan el micrófono ni imprimen contenido o credenciales. [Guía](../docs/VOICE_TUTOR.md).

Ejecuta los comandos desde la raíz, donde están `.venv` y `package.json`. Estas herramientas conectan frontend y backend; no contienen lógica educativa ni credenciales. Los scripts históricos están en `legacy/scripts/`.

- `migrate_sqlite.py`: migración explícita SQLite → PostgreSQL con respaldo, destino vacío y verificación transaccional. Detener FastAPI antes; ejecutar `node scripts/python.mjs -m scripts.migrate_sqlite`.
