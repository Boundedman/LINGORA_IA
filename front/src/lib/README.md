# Cliente y estado

- `db.ts`: `api()` envía JSON del mismo origen con la cookie de sesión, adapta errores y ofrece autenticación y RPC. El nombre `db` se conserva como interfaz local, pero ya no representa Supabase ni acceso directo a SQLite.

`useLearner` sincroniza al iniciar sesión y al volver a la ventana. Los eventos de foco repetidos se limitan a una solicitud cada 15 segundos y se omiten si ya hay una carga pendiente. Las actualizaciones explícitas de progreso conservan su recarga inmediata. Guardar perfil o foto aplica la respuesta confirmada del servidor sin volver a descargar todo el catálogo y progreso; las respuestas de otra cuenta se descartan.
- `useLearner.ts`: carga sesión, perfil, catálogo, progreso, repasos y diagnóstico; refresca después de acciones y al recuperar el foco de la ventana.
- `dictionary.ts`: construye consultas al diccionario inglés-español de Cambridge mediante URLSearchParams, conservando expresiones y codificando puntuación. Solo crea enlaces externos; no consulta una API ni envía datos de cuenta.

Los componentes usan estas funciones para comunicarse con `/api/*`. FastAPI identifica al usuario mediante una cookie HttpOnly; JavaScript no necesita leer el token. No introduzcas claves de proveedor en esta carpeta.

Voz: `useVoiceSession.ts` administra conexión/cierre, `voiceAudio.ts` captura y reproduce audio, `pcm-worklet.js` convierte PCM en el hilo de audio, y `voiceTypes.ts` define los contratos. El navegador conecta únicamente con `/api/voice/live`; nunca recibe la clave Gemini. [Detalles](../../../docs/VOICE_TUTOR.md).

`useLearner` incluye avatar y descarta respuestas de cuentas anteriores al cambiar de sesión. Las fotos llegan desde la API autenticada; no se usan enlaces públicos de Supabase Storage.
