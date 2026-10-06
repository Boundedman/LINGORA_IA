# Guía del proyecto Lingora

## Qué cambió

El prototipo ahora utiliza Python, FastAPI y SQLite en una sola aplicación. Mantiene la interfaz React, su diseño visual, componentes, iconos y contenido educativo. FastAPI entrega las pantallas compiladas y atiende todas las operaciones de cuenta, progreso y tutor.

La versión anterior con Supabase y Netlify queda conservada como referencia en `legacy/` (c?digo) y `docs/legacy/` (documentaci?n). No se necesita configurarla para trabajar con el prototipo actual.

## Qué puedes usar

- Catálogo de 28 lecciones A1–B2 en siete habilidades y práctica sin cuenta.
- Glosario local original con 64 palabras y expresiones en 8 secciones: presentaciones, rutinas, viajes, comida, trabajo, aprendizaje, conectores y expresiones. Incluye notas de uso y ejemplos traducidos; se consulta desde «Glosario» o «Explorar el glosario» dentro de una lección.
- Registro local y acceso por correo/contraseña; perfil, interés y nivel declarado.
- Ejercicios con persistencia, corrección de respuestas cerradas y continuidad entre dispositivos conectados al mismo servidor.
- Repasos SM-2 y progreso por habilidad.
- Diagnóstico pausable de hasta quince minutos activos, con conflictos entre dispositivos controlados.
- Tutor por texto, feedback opcional de escritura/audio y módulo Gemini Live en Tutor IA → Por voz; configuración, privacidad y verificaciones pendientes en [VOICE_TUTOR.md](VOICE_TUTOR.md).
- Listening con voz del navegador, grabación y reproducción local.
- Enlaces «Consultar en Cambridge» junto al vocabulario de cada unidad, para consultar significados y pronunciación en un recurso externo independiente.
- Reportes de contenido, exportación de datos, borrado de conversaciones y eliminación de cuenta.
- Cambio de contraseña y recuperación por correo si se configura SMTP.

El registro local entra directamente, sin confirmación de correo. La lista `PILOT_INVITES` restringe los correos permitidos cuando se configura; vacía permite probar el registro local. La práctica oral no asigna precisión fonética ni certifica un nivel.

## Dónde trabajar

- Diseño y adaptación móvil: `front/src/styles.css`.
- Pantallas y navegación: `front/src/App.tsx` y `front/src/components/`.
- Recuperación de contraseña: `front/src/components/ResetPassword.tsx`.
- Contenido: `front/src/data/curriculum.ts` y `front/src/data/assessment.ts`.
- Glosario propio: `front/src/data/glossary.ts`; filtros en `front/src/domain/glossary.ts` y presentación en `front/src/components/GlossaryView.tsx`. Las 16 palabras distintas del catálogo original están incluidas, además de 48 nuevas. Los niveles son orientativos y el contenido no proviene de una descarga de Cambridge.
- Reglas de presentación del aprendizaje: `front/src/domain/learning.ts`.
- Estado del alumno y HTTP: `front/src/lib/useLearner.ts` y `front/src/lib/db.ts`.
- Enlaces de diccionario: `front/src/lib/dictionary.ts`; la vista reutiliza el constructor para cada palabra y expresión sin añadir consultas al backend.
- API y validación: `back/main.py`.
- Cuentas: `back/auth.py`.
- Persistencia y transacciones: `back/storage.py`.
- Reglas definitivas de progreso, diagnóstico y repasos: `back/learning.py`.
- Personalidad, contexto, proveedor, cuotas e historial de IA: `back/ai.py`.
- Pruebas Python: `back/tests/test_app.py`; pruebas de interfaz y aprendizaje: `front/tests/`.

## Arranque y flujo de trabajo

Sigue [SETUP_GUIDE.md](SETUP_GUIDE.md). El servidor único abre en http://127.0.0.1:8000 y crea SQLite al iniciar. `npm run build` verifica TypeScript, exporta el catálogo a Python y compila la interfaz; `npm start` inicia FastAPI. `npm run dev:api` y `npm run dev:ui` permiten editar con recarga durante desarrollo.

`npm run preview` solo muestra la compilación de Vite y no inicia FastAPI. `npm run seed:legacy` y `npm run test:db:legacy` corresponden al Supabase anterior. No los necesitas para esta versión.

## Antes de invitar al piloto

Configura la lista de participantes y el acceso al mismo servidor. Si habilitas IA o recuperación, prueba el modelo y SMTP reales. Para acceso público se necesita HTTPS y almacenamiento persistente. Revisa el contenido educativo y las interacciones de micrófono en dispositivos reales. Respalda SQLite con el servidor detenido.

No se publicó el proyecto ni se importaron datos externos. Las limitaciones educativas del piloto se mantienen: catálogo inicial, diagnóstico orientativo, respuestas abiertas sin nivel automático validado y ausencia de análisis fonético preciso.

Más detalles: [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [docs/ALCANCE.md](ALCANCE.md) y [BITACORA.md](../BITACORA.md).

## Registro y configuración de cuenta

Para crear una cuenta se pide nombre, correo y contraseña; la foto es opcional. El avatar de la navegación abre Configuración de cuenta, donde aparecen correo, foto y perfil. Se puede subir o quitar la foto, actualizar contraseña, exportar datos, cerrar sesión y cambiar de cuenta. Cambiar de cuenta cierra la sesión actual y abre el formulario de acceso. JPG/PNG/WebP: hasta 2 MB y 16 megapíxeles; el servidor guarda una versión de 256×256.
