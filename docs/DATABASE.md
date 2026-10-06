# Datos del prototipo

El módulo de voz añade los tipos `voice_sessions` (metadatos de cuota, dos días) y `voice_summaries` (resúmenes optativos, 30 días) a `records`, sin crear tablas ni copiar audio/transcripciones completas. Tienen el mismo aislamiento por usuario y borrado en cascada. El historial permite eliminar cada resumen; la exportación incluye ambos tipos. La limpieza se ejecuta al arrancar, cada hora y antes de consultar/reservar. [Política y límites](VOICE_TUTOR.md).

Con DATABASE_URL, PostgreSQL de Supabase guarda cuentas y actividad en el esquema privado lingora. Sin DATABASE_URL, se conserva SQLite en data/lingora.sqlite3. No se hace fallback silencioso a SQLite si PostgreSQL falla. No se usan Supabase Auth ni los scripts legacy.

## Estructura

- `users`: identificador, nombre visible (`display_name`), correo único y hash PBKDF2 de contraseña con sal individual. El nombre se completa desde el perfil, no es un identificador único de acceso.
- `sessions`: hash del token, usuario y vencimiento; siete días.
- `resets`: hash del token de recuperación, usuario y vencimiento; treinta minutos, un solo uso.
- `records`: registros JSON identificados por tipo, usuario e identificador. Contiene perfiles, avances, intentos, errores, repasos, diagnóstico, mensajes, reportes, solicitudes de IA y caché.

Las claves foráneas eliminan sesiones, tokens y registros al borrar una cuenta. Cada lectura de datos privados se limita al usuario de la sesión; no se acepta un identificador de usuario enviado por el cliente. Los cambios de contraseña invalidan las sesiones anteriores.

Las transacciones serializan las escrituras y reservas de IA. Las versiones permiten detectar conflictos entre dispositivos. SQLite es suficiente para el pequeño prototipo; no debe usarse el mismo archivo desde varios servidores o máquinas mediante una carpeta de red.

La exportación de cuenta incluye perfil, avance, intentos, repasos, diagnóstico, errores, mensajes, reportes y uso de IA. No incluye hashes de contraseña, sesiones ni tokens de recuperación. El audio se envía solo para feedback opcional y no se guarda.

El contenido original vive en `front/src/data/curriculum.ts`; el proceso de compilación genera `back/curriculum.json`. La migración de SQLite a Supabase es explícita; consulta el procedimiento siguiente. La documentación del esquema anterior está conservada en `docs/legacy/DATABASE.md`.

Para respaldar, detén FastAPI y copia el archivo de SQLite; para restaurar, detén el servidor y sustituye el archivo por el respaldo. Conserva los respaldos fuera del repositorio y con acceso restringido.


## Conectar y migrar a Supabase

1. Instala back/requirements.lock.txt y configura DATABASE_URL en el .env raíz con la URI Session pooler de Supabase y la contraseña codificada para URL, sin corchetes. Nunca uses una variable VITE_ para esta credencial.
2. Ejecuta `node scripts/python.mjs scripts/check_supabase.py` (solo lectura).
3. Detén FastAPI para evitar nuevas escrituras y ejecuta `node scripts/python.mjs -m scripts.migrate_sqlite`. El script crea un respaldo SQLite en data/, exige destino vacío, importa las cuatro tablas en una transacción y compara todos sus valores antes del commit. No sobrescribe registros existentes.
4. Arranca FastAPI. `/api/health` comprueba la conexión y devuelve storage: postgresql. Se mantienen los hashes de contraseña, sesiones y progreso. El catálogo y Gemini conservan su implementación.

El esquema privado tiene permisos revocados para PUBLIC, anon y authenticated; sus tablas tienen RLS habilitado sin políticas públicas. Solo el backend accede con su credencial PostgreSQL. Los registros tienen ordinal de inserción para preservar su orden. La cuenta de conexión debe poder crear el esquema; la URI nunca se entrega al navegador.

Las pruebas usan SQLite por defecto aunque exista DATABASE_URL. TEST_DATABASE_URL habilita pruebas PostgreSQL en esquemas lingora_test_<uuid> que se eliminan al finalizar. No configures DATABASE_SCHEMA con uno de esos nombres para la aplicación real.

Para volver a SQLite, detén el servidor y vacía DATABASE_URL. El archivo local conserva el estado anterior a la migración: los avances posteriores en PostgreSQL no se copian de vuelta automáticamente. Los respaldos posteriores de PostgreSQL deben realizarse mediante las herramientas de Supabase/PostgreSQL.


## SQL completo y datos de la aplicación

[back/schema.sql](../back/schema.sql) es el archivo completo para Supabase SQL Editor, usando el rol postgres. FastAPI lo utiliza también al arrancar PostgreSQL, dentro de una transacción. Se puede ejecutar más de una vez: añade display_name a users si falta y recupera nombres de los perfiles existentes sin sustituir hashes ni avances. El backend sincroniza perfil y nombre en la misma transacción. SQLite recibe la actualización equivalente.

En Table Editor selecciona el esquema **lingora**. En users verás display_name, email y password (hash). En records filtra la columna kind para consultar:

- `profiles`: nombre, nivel, origen del nivel, intereses, minutos diarios y onboarding.
- `lesson_progress`: lección, paso actual, aciertos, intentos, finalización y versión.
- `exercise_attempts`: respuestas de ejercicios y corrección.
- `reviews`: tarjetas, intervalos y próximas fechas de repaso.
- `diagnostics`: respuestas, tiempo, estado y versión del diagnóstico.
- `user_errors`: errores y explicaciones.
- `messages`: historial del tutor.
- `feedback`: reportes sobre lecciones.
- `ai_requests`: reservas, consumo y cuotas de IA.
- `ai_cache`: respuestas reutilizables y caducidad.

payload contiene JSON serializado como TEXT, conservando el formato del prototipo. No hace falta crear tablas duplicadas para almacenar estos datos. Cada registro pertenece a un usuario y se elimina por cascada al borrar su cuenta. sessions y resets guardan hashes de tokens y vencimientos.

Las 28 lecciones y el glosario siguen en los archivos del proyecto; las claves de Gemini y de conexión permanecen en .env. No se guardan contraseñas en texto plano ni se usa Supabase Auth. Edita el nombre desde el perfil de LINGORA para mantener sincronizados users y profiles.

## Fotos de perfil

`records` con kind=avatars guarda un JPEG de 256×256 como data_url, asociado al usuario. Se incluye en la exportación de cuenta y se borra por cascada al eliminarla. No requiere una tabla adicional ni un bucket público. Sin registro de foto, el frontend muestra el avatar predeterminado. La foto se valida y recodifica sin EXIF; no se envía al tutor Gemini. El nombre es obligatorio al registrarse y continúa sincronizado con users.display_name.
