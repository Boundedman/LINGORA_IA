# Alcance del piloto acordado

- 5–10 adultos hispanohablantes con distintos niveles de inglés.
- Aplicación web para celular y computadora; misma cuenta y avance sincronizado con conexión.
- Lecciones de A1 a B2. La arquitectura podrá ampliarse a otros idiomas y edades.
- Declarar el nivel o realizar un diagnóstico opcional por habilidades.
- Diagnóstico pausable, con máximo 15 minutos activos. El tiempo restante se conserva.
- El estudiante expresa su interés principal en el chat y puede cambiarlo.
- Tutor por texto y módulo opcional por voz, ampliación solicitada el 5 de octubre de 2026. Configuración y validaciones pendientes en [VOICE_TUTOR.md](VOICE_TUTOR.md).
- Actividades de vocabulario, gramática, lectura, escucha, escritura, expresión oral y pronunciación.
- Prioridad de costo mínimo. Destino vigente: interfaz y proxy en Cloudflare, FastAPI en Render y PostgreSQL en Supabase; Netlify queda como referencia histórica.

## Interpretaciones de implementación

El audio de lecciones y diagnóstico se mantiene. La exclusión original de conversación por voz fue reemplazada por la solicitud de implementar PROMT_CHAT_DE_VOZ.md. En lecciones y diagnóstico las grabaciones locales se descartan al salir y se guarda solo el feedback que el usuario decida incorporar. En conversación Live no se guarda audio; el resumen se persiste solo por elección explícita.

El piloto parte de una colección inicial de 28 lecciones. Para convertirla en un curso completo se necesita ampliar unidades, objetivos, evaluaciones y revisar pedagógicamente el contenido. El diagnóstico no certifica MCER ni asigna nivel validado a respuestas abiertas.

Se usa React/TypeScript con Vite y un backend monolítico FastAPI. La persistencia usa PostgreSQL cuando se configura DATABASE_URL y SQLite como alternativa local. Los repasos usan SM-2 como base inicial documentada; no se presentan como FSRS.

Los servicios ya fueron publicados según las verificaciones registradas en la bitácora del 25 y 26 de septiembre. El flujo completo entre dispositivos requiere una prueba con la misma cuenta en los dispositivos del piloto.

## Criterios de aceptación y validación educativa

La primera versión incluye 28 lecciones distribuidas entre A1, A2, B1 y B2 y las siete habilidades; no representa un curso completo de cada nivel. Cada actividad debe tener objetivo, consigna, ejemplos y explicación coherentes, y las respuestas cerradas deben coincidir con la corrección. Las pruebas automáticas comprueban cobertura y consistencia; la revisión pedagógica con participantes sigue siendo una validación externa pendiente.

El diagnóstico debe conservar respuestas y tiempo al pausar y reanudar, limitarse a 15 minutos activos y mostrar evidencia insuficiente cuando no hay respuestas evaluables. Escritura, expresión oral y pronunciación no reciben una calificación fonética ni un nivel certificado. El piloto conserva el nivel declarado del estudiante.

Para validar con los 5–10 adultos se debe observar que puedan entrar, completar una lección, retomar progreso en otro dispositivo, pausar el diagnóstico, elegir una temática del tutor y reportar una corrección dudosa. Registrar dificultades y revisar los reportes antes de ampliar el contenido. Estos son criterios de revisión, no resultados ya obtenidos ni una autorización de gasto.

Gemini se solicita al enviar un mensaje o pedir feedback explícitamente. Navegar, elegir un interés, consultar el glosario y realizar repasos no deben generar llamadas al proveedor. El historial del tutor se limpia al salir de su vista y al cerrar sesión; al volver se ofrece elegir temática. El envío de limpieza al cerrar una pestaña depende del navegador y la red: una nueva entrada al tutor vuelve a limpiar antes de habilitar el envío.
