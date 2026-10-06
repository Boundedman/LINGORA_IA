# Pruebas de frontend

- `voice-audio.test.ts`: PCM16 desde frecuencias reales, mute, permiso tardío y vaciado de la cola de altavoz, con dispositivos simulados.
- `voice-ui.test.ts`: preparación sin captura automática, consentimiento y ciclo de voz (interrupción, audio obsoleto y cierre antes de evaluar). Usa un entorno aislado para no mezclar los dobles de WebSocket/AudioContext con la UI general.

- `learning.test.ts`: normalización, repasos, siguiente lección, diagnóstico y cobertura del catálogo.
- `dictionary.test.ts`: consultas de Cambridge para palabras, expresiones y puntuación, origen fijo y cobertura de todo el vocabulario de las 28 lecciones.
- `glossary.test.ts`: cobertura de los términos de las lecciones, entradas completas y sin duplicados, búsqueda bilingüe con acentos y filtros combinados. La prueba de interfaz comprueba acceso anónimo, contenido local, búsqueda, resultado vacío, limpieza y selección temática.
- `ui.test.ts`: JSDOM y React Testing Library comprueban práctica, filtros y acceso al diagnóstico. Simula una sesión anónima; no consulta al proveedor.

Ejecuta `npm test` desde la raíz y `npm run lint` para tipos. Complementan `back/tests/`; no sustituyen pruebas de micrófono, SMTP o Gemini reales. Las del antiguo proveedor TypeScript están en `legacy/tests/`.

La prueba de interfaz también abre el vocabulario y comprueba texto, ubicación y atributos de los enlaces Cambridge. No consulta el sitio externo durante los tests.

Las pruebas de interfaz también cubren registro con nombre y avatar por defecto, carga/eliminación de foto y cambio de cuenta con una respuesta anterior retrasada.

También verifican que navegar no invoque IA, que los eventos repetidos de foco no dupliquen la recarga de datos y que guardar el perfil use la respuesta del servidor sin descargar otra vez el catálogo. El tutor se prueba al salir, recibir una respuesta tardía y regresar desde la caché de navegación: vuelve a pedir temática y descarta el texto de la conversación anterior.
