# Actividades y cuenta

- `Auth.tsx`: acceso, registro y solicitud de recuperación; confirmación de mayoría de edad y errores del servidor.
- `ResetPassword.tsx`: recibe el token de recuperación y envía una nueva contraseña.
- `LessonView.tsx`: explicaciones, preguntas, corrección, avance y reporte de contenido. Sin sesión permite práctica temporal; con sesión guarda en la API.
- `DiagnosticView.tsx`: preguntas, pausas, reloj, guardado periódico, actividades abiertas y resultados orientativos. Envía versiones para detectar conflictos entre dispositivos.
- `Tutor.tsx`: interés del alumno, historial y conversación mediante el servidor.
- `TutorHub.tsx`: alterna texto y voz. `VoiceTutor.tsx` y `voice.css`: preparación, permisos, controles, transcripción, resumen e historial de voz; el audio y el transporte están separados en `../lib/`. [Guía](../../../docs/VOICE_TUTOR.md).
- `GlossaryView.tsx`: consulta local de 64 palabras y expresiones organizadas en 8 secciones, buscador, filtros de nivel/tema, ejemplos traducidos y propuestas de práctica libre. Disponible sin sesión; no guarda resultados ni modifica el progreso.
- `AudioPractice.tsx`: síntesis de voz y grabación/reproducción local. El diagnóstico permite enviar audio para feedback opcional.

Reciben estado y callbacks de la aplicación. Comparten `../styles.css` y `../lib/db.ts`; las claves y persistencia quedan en Python. El micrófono requiere permiso del navegador y HTTPS fuera de localhost.

En «Palabras de esta unidad», `LessonView.tsx` ofrece «Consultar en Cambridge» junto a cada término usando `../lib/dictionary.ts`. Se abre en otra pestaña con `noopener noreferrer`. El aviso identifica a Cambridge como recurso externo independiente para significados y pronunciación; no se importan sus textos o audios.

El botón «Explorar el glosario» abre el contenido propio dentro de LINGORA. También está disponible desde «Glosario» en la navegación principal; las consultas locales no dependen de que Cambridge abra.

- `Avatar.tsx`: foto circular o icono de usuario predeterminado, compartido por la navegación y los formularios.
- `PhotoPicker.tsx`: selección local, límites de archivo y vista previa de JPG/PNG/WebP.
- `AccountPhoto.tsx`: guarda o quita la foto desde la configuración de cuenta.

El registro pide nombre, correo y contraseña, con foto opcional. Mi cuenta abre configuración desde el avatar. Cambiar de cuenta invalida la sesión actual y abre el acceso; no mantiene varias sesiones simultáneas.
