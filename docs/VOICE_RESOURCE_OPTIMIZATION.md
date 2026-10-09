# Recursos de voz

La cuota de Lingora cuenta inicios diarios y sesiones simultáneas; no cuenta tokens ni termina sesiones por duración. No se elevaron límites ni se cambiaron variables de producción. Los intentos que fallan antes de setupComplete se liberan sin consumir un inicio diario. Las reservas pendientes sí ocupan una plaza; las caducadas sin inicio no cuentan. Las sesiones antiguas con duración o audio siguen contando. El día interno se renueva a medianoche UTC (18:00 en Ciudad de México).

## Cambios

- Errores con códigos distintos: user_daily_limit, global_daily_limit, concurrent_limit, provider_quota, provider_setup y provider_connection. Las respuestas no exponen mensajes internos, claves ni motivos de cierre sin filtrar. Los fallos de sesión se registran por código para diagnóstico.
- Contexto: compresión al llegar a 12 000 tokens, objetivo 6 000. LIVE_CONTEXT_TRIGGER_TOKENS admite 4096–32000 y LIVE_CONTEXT_TARGET_TOKENS 2048–16000, limitado a la mitad del umbral. Los valores inválidos usan valores predeterminados. Puede perderse información antigua; la compresión tiene latencia y el objetivo no garantiza un número exacto. No se añade un diccionario al prompt.
- Cobertura explícita TURN_INCLUDES_ONLY_ACTIVITY con detección automática de actividad de Gemini. Se mantienen las transcripciones para el estado de procesamiento y la vista opcional; su coste adicional permanece.
- Filtro local de baja energía sobre PCM16 en paquetes de 20 ms. Umbral RMS 0.0015, memoria previa 200 ms y cola de silencio 1200 ms. Después se envía audioStreamEnd una vez; el siguiente sonido reabre el flujo sin reconectar ni pulsar botones. El micrófono sigue capturando localmente hasta Finalizar. Silenciar, desconectar y cerrar descartan la memoria previa.
- El filtro no reconoce palabras ni distingue ruido de voz. Ruido sostenido seguirá transmitiéndose y susurros por debajo del umbral pueden perderse. Necesita calibración en micrófonos reales; no se promete ahorro de tokens. En gemini-3.8-live el audio proactivo puede seguir cobrando escucha aunque disminuya el tráfico.
- LIVE_FILTER_SILENCE=false permite volver al envío continuo al iniciar la siguiente sesión, sin modificar el código; /api/voice/config comunica esta opción al navegador.
- Reconexiones: el límite de reintentos se aplica a fallos consecutivos, sin bloquear una conversación larga tras dos reconexiones satisfactorias. Se conserva la exigencia de handle y límite de turno para reanudar con seguridad.

## Medición y diagnóstico

voice_sessions guarda input_bytes, duración y metrics, sin audio ni transcripciones. metrics contiene número de reportes de uso, suma de totalTokenCount reportado, máximo promptTokenCount, suma de responseTokenCount, bytes de salida, reconexiones y código del error. El campo antiguo total_tokens sigue siendo el máximo observado para compatibilidad. No confundir ninguna suma con una factura: si el proveedor repite reportes, también se repiten en la suma. Contrastar con Google AI Studio.

El backend emite voice_session_error (WARNING, solo código) y voice_session_metrics (INFO). Activar INFO para el logger lingora.voice en el sistema de observabilidad si se necesita ver métricas finales en registros. Los registros no incluyen identificadores de usuarios, handles ni datos de conversación. La base conserva la política de purga existente de sesiones de dos días.

Comparar conversaciones equivalentes de más de cinco minutos: tráfico PCM recibido, pico de contexto, reportes de uso, reconexiones y consumo del proyecto en AI Studio. Probar silencio largo, voz baja, ruido, auriculares/altavoz, pausas dentro de frases, interrupción del asistente, Finalizar y nueva sesión. Las pruebas automáticas cubren audio sintético y proveedor simulado; no acreditan calidad acústica ni ahorro facturado en producción.

El glosario y los ejercicios existentes funcionan localmente sin llamadas de voz. Un futuro modo de audios reutilizables o reconocimiento → modelo de texto → síntesis requiere un flujo propio y validación de latencia/interrupciones; no forma parte de estos cambios.

Fuentes oficiales consultadas:
- https://ai.google.dev/gemini-api/docs/live-api/best-practices
- https://ai.google.dev/api/live.md
- https://ai.google.dev/gemini-api/docs/live-api/session-management
