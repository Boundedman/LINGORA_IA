# Tutor de voz de Lingora

Implementación de [PROMT_CHAT_DE_VOZ.md](../PROMT_CHAT_DE_VOZ.md), solicitada el 5 de octubre de 2026. Amplía el alcance anterior de tutor solo por texto y conserva las lecciones y el diagnóstico.

## Uso

En **Tutor IA → Por voz**, inicia sesión, elige modo, nivel declarado o «No lo sé», escenario, tema, objetivo y voz. Acepta enviar audio antes de iniciar. Guardar el resumen es una elección independiente, desactivada por defecto.

El navegador solicita micrófono solo al pulsar Iniciar. Silenciar desactiva pistas y envío. Detener voz vacía el audio del turno actual. Finalizar libera el micrófono antes de evaluar; salir del módulo también libera recursos. Si un permiso pendiente llega después de finalizar, sus pistas se cierran. Ocultar la pestaña silencia y detiene reproducción; volver no reactiva el micrófono automáticamente.

La transcripción opcional distingue fragmentos parciales. La visualización representa niveles reales; el altavoz tiene estado independiente del micrófono. Se respeta movimiento reducido y se detiene movimiento decorativo en segundo plano. Tras 30 segundos sin actividad se ofrece una ayuda escrita una sola vez, sin llamar al proveedor. Para cambiar de modo se finaliza e inicia otra práctica.

## Arquitectura y archivos

- `front/src/components/TutorHub.tsx`: selector texto/voz y desmontaje de la modalidad anterior.
- `VoiceTutor.tsx`, `voice.css`: preparación, consentimiento, controles, transcripción, resumen e historial; reutilizan el sistema visual existente.
- `front/src/lib/useVoiceSession.ts`: estados, cancelación, WebSocket, eventos, duración y limpieza idempotente.
- `voiceAudio.ts`: permiso, pistas, AudioContext, analizadores y reproducción secuencial. Cola de hasta 12 segundos pendientes; ante congestión termina explícitamente.
- `pcm-worklet.js`: AudioWorklet que convierte desde la frecuencia real a PCM16 mono little-endian de 16 kHz, en bloques de 20 ms. No usa WebM/Opus ni graba archivos. Remuestreo básico por promedio ponderado, no un filtro de audio profesional.
- `voiceTypes.ts`: contratos internos de frontend.
- `back/voice.py`: autorización, cuotas, proxy, evaluación, retención e historial.
- `voice_contracts.py`: opciones y validación de feedback contra turnos reales del servidor.
- `voice_prompts.py`: política, modos fluidez/tutor activo, escenarios y evaluador; sin herramientas privilegiadas.
- `scripts/check_live.py`: comprobaciones reales opcionales, sin imprimir audio, transcripciones o claves.

Transporte: **navegador → FastAPI → Gemini Developer API v1beta**, WebSocket directo con `websockets==17.1`. No se usa Vertex AI ni el SDK Google. La clave permanente solo viaja de FastAPI a Google en una cabecera. No se entregan claves ni tokens efímeros al navegador; el proxy permite imponer tráfico y duración en servidor. Cloudflare conserva el upgrade 101, y Vite incluye proxy WebSocket en desarrollo.

La salida es PCM16 de 24 kHz. Se procesan todas las partes de audio. El evento oficial `interrupted` vacía el altavoz; los IDs internos de turno permiten descartar audio antiguo. Detener voz cancela reproducción local; no envía mensajes ficticios al proveedor ni garantiza ahorrar generación.

## Configuración

```powershell
.venv\Scripts\python.exe -m pip install -r back/requirements.txt
npm run build
```

En el backend, conserva `AI_API_KEY` privada y `AI_MODEL` de texto para los resúmenes. Añade:

```dotenv
AI_ENABLED=true
AI_PROVIDER=gemini
LIVE_ENABLED=true
LIVE_MODEL=gemini-3.8-live
LIVE_MAX_SECONDS=300
LIVE_DAILY_SESSIONS_PER_USER=3
LIVE_DAILY_SESSIONS_GLOBAL=20
LIVE_CONCURRENT_GLOBAL=3
```

La lista cerrada admite también `gemini-3.1-flash-live-preview`. Las voces ofrecidas son Kore, Puck y Aoede, sin atribuirles características no escuchadas; Kore se verificó en vivo. El modelo del chat de texto no cambia. `.env.example` y el Blueprint mantienen voz desactivada hasta configurarla. Esto no modifica las variables ni los secretos remotos.

En este entorno se habilitó `.env` local con el modelo comprobado, sesiones de cinco minutos, tres por usuario al día, veinte globales y tres simultáneas. Reiniciar FastAPI para cargar estos cambios. La activación remota sigue siendo independiente.

```powershell
# Solo consulta modelos; no genera audio.
.venv\Scripts\python.exe scripts/check_live.py
# Genera una respuesta breve: consume cuota.
.venv\Scripts\python.exe scripts/check_live.py --handshake
# Envía la muestra pública PCM de la guía oficial de Google: consume cuota.
.venv\Scripts\python.exe scripts/check_live.py --sample
```

El diagnóstico experimental `--loopback` reenvía la propia voz del modelo: durante esta revisión terminó sin transcripción ni respuesta después de una interrupción. No se usa como criterio de aceptación ni como entrada del producto. La prueba con la muestra oficial sí verificó audio de entrada, transcripción y audio de respuesta.

## Límites, recuperación y seguridad

- `/api/voice/config`: disponibilidad y opciones públicas; sin llamadas al proveedor.
- `/api/voice/live`: cookie válida, origen exacto y consentimiento. En producción, `APP_URL` es la URL HTTPS exacta de Cloudflare y `COOKIE_SECURE=true`. No acepta usuario, modelo, herramientas o límites arbitrarios del navegador.
- Una sesión simultánea por usuario; hasta 10 globales, 3 por defecto. Cuotas diarias UTC, incluidos intentos reservados: máximo configurable de 20 por usuario y 100 globales; valores por defecto 3 y 20.
- Duración de 30–600 segundos, 300 por defecto. El corte del servidor incluye conexión y reconexiones. El reloj mostrado cuenta desde la conexión activa.
- Máximo 6400 bytes PCM por mensaje, 65 mensajes por segundo y presupuesto de bytes por tiempo. Render configura además `--ws-max-size 8192 --ws-max-queue 4`.
- Hasta dos reintentos progresivos. Después de conectar, solo se reanuda con un identificador oficial y un límite seguro de turno; si no es seguro, se finaliza parcialmente. Tras reanudar, el micrófono queda silenciado. La caída navegador–FastAPI finaliza y exige un nuevo inicio explícito, evitando sesiones duplicadas.
- La cookie se revalida cada 10 segundos. Logout, revocación o eliminación de cuenta cierran la sesión activa en esa comprobación. Tras una caída del proceso, una reserva vence como máximo al llegar a su duración más 45 segundos.
- Una evaluación por sesión, dentro del cierre, con timeout de 18 segundos. No hay endpoint que permita evaluar repetidamente texto arbitrario del navegador. Su consumo adicional queda limitado por las cuotas de voz; no usa el contador del tutor escrito.
- Errores saneados y logger del transporte aislado. No habilitar DEBUG de WebSocket en producción.

## Feedback y datos

Evaluación al finalizar, sin herramientas en vivo. En modo fluidez no aparecen correcciones durante la conversación; en tutor activo puede haber recasts hablados. Los prompts pedagógicos no garantizan cumplimiento perfecto del modelo.

El evaluador recibe hasta 24 000 caracteres de turnos del servidor. Se comprueban pertenencia, IDs, citas exactas, longitudes, categorías y duplicados. Se descartan confianza baja, pronunciación y supuesta evidencia de audio, porque el evaluador recibe solamente texto. Hasta tres fortalezas, tres mejoras y una práctica; si falla o no hay evidencia se informa sin inventar una calificación. No hay porcentajes ni nivel MCER certificado. La duración es calculada; participación oral: «no disponible».

No se guardan audio ni transcripciones completas en disco o logs. Se mantienen temporalmente en memoria con límites. Se aprovecha `records`, sin migraciones destructivas:

- `voice_sessions`: cuotas, estado, duración, bytes y tokens disponibles; dos días. Sin tema ni transcripción.
- `voice_summaries`: solo por consentimiento de almacenamiento; resumen y citas breves disponibles 30 días. Aislados por cuenta, incluidos en exportación y eliminados al borrar la cuenta.

`GET /api/voice/history` consulta los propios; `DELETE /api/voice/history/{id}` elimina uno propio. Limpieza al arrancar, cada hora mientras funciona FastAPI y antes de consultar historial/reservar. Si el servicio está apagado, la eliminación física espera al siguiente arranque; no se devuelven resúmenes vencidos. Los respaldos administrados y la retención propia de Google no se controlan aquí. No se promete borrar copias del proveedor.

## Despliegue

1. Publicar backend actualizado y Worker; instalar la nueva dependencia en Render. Publicar solo `front/dist` no basta.
2. Mantener `BACKEND_URL` en el backend HTTPS y comprobar upgrade de `/api/voice/live` a través de Cloudflare.
3. Configurar `APP_URL`, variables privadas y cuotas; activar `LIVE_ENABLED=true` para las pruebas. El Blueprint se entrega con `false`.
4. Compilar la interfaz: Vite emite el AudioWorklet como `/assets/*.js`, compatible con CSP, evitando scripts `data:`.
5. Probar con una cuenta de prueba, auriculares y micrófono en móvil/escritorio. Los arranques en frío de Render pueden superar el timeout; la interfaz ofrece reintento explícito.

No se desplegaron servicios durante esta tarea.

## Criterios de aceptación y evidencia

Validación automática: 26 pruebas existentes de backend y 20 específicas de voz; 26 de frontend; 4 del Worker. TypeScript y compilación Vite correctos. El AudioWorklet emitido se obtuvo por HTTP 200 desde FastAPI y sus bytes coincidieron con la compilación. Comprobación de secretos conocidos sobre 41 archivos: sin coincidencias; `.env` continúa excluido de Git. No es una auditoría de seguridad exhaustiva.

- [x] Integración, preparación, controles y privacidad por defecto: componentes, pruebas JSDOM y tipos.
- [x] PCM little-endian desde 16/24/44.1/48 kHz: AudioWorklet ejecutado en entorno aislado con bloques de audio.
- [x] Reproducción secuencial, vaciado y permiso tardío después de cerrar: pruebas con AudioContext/MediaStream simulados.
- [x] Autenticación, origen, parámetros, cuotas, concurrencia, duración y cierre durante conexión: pruebas FastAPI con proveedor simulado.
- [x] Historial privado, eliminación, vencimiento, citas verificables y fallback: pruebas backend.
- [x] Upgrade WebSocket preservado: prueba Worker con transporte simulado.
- [x] Modelo real, 2026-10-05: `gemini-3.8-live`, Kore, setup aceptado, salida PCM24k. Primer fragmento en 970 ms desde conexión en una prueba; **no mide latencia hasta reproducción** ni es una promesa universal.
- [x] Audio bidireccional del proveedor: muestra oficial de 96 938 bytes PCM16k transcrita y contestada con audio; sin micrófono de usuario.
- [x] Evaluador real: frase sintética con error de pasado produjo JSON validado, una fortaleza y una mejora; sin conversaciones personales.
- [ ] Micrófono/altavoz reales, latencia audible, dispositivos ocupados y pérdida de red en móvil: pendientes de dispositivo y navegador.
- [ ] Capturas reales móvil/escritorio/error, movimiento reducido, teclado y lector de pantalla: estilos y atributos implementados; la herramienta de navegador no tiene ninguna instancia disponible, por lo que no se verificaron visualmente.
- [ ] Pedagogía observada con principiantes/intermedios, variantes, despedidas y español: pendiente del piloto con participantes.
- [ ] Publicación y flujo autenticado Cloudflare/Render: no ejecutados.

No se declara listo para producción mientras falten estas verificaciones.

## Fuentes oficiales consultadas el 2026-10-05

- [Gemini Live WebSocket v1beta](https://ai.google.dev/api/live): setup, audio, eventos e interrupción.
- [Capacidades Live](https://ai.google.dev/gemini-api/docs/live-api/capabilities): modelos, PCM, voces y VAD.
- [Gestión de sesiones](https://ai.google.dev/gemini-api/docs/live-api/session-management): reanudación.
- [websockets](https://websockets.readthedocs.io/en/stable/reference/asyncio/client.html): cabeceras, timeouts, colas y cierre.
- [Cloudflare WebSockets](https://developers.cloudflare.com/workers/examples/websockets/): upgrade y proxy.
- [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode): procesamiento de audio.
