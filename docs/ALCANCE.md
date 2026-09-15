# Alcance del piloto acordado

- 5–10 adultos hispanohablantes con distintos niveles de inglés.
- Aplicación web para celular y computadora; misma cuenta y avance sincronizado con conexión.
- Lecciones de A1 a B2. La arquitectura podrá ampliarse a otros idiomas y edades.
- Declarar el nivel o realizar un diagnóstico opcional por habilidades.
- Diagnóstico pausable, con máximo 15 minutos activos. El tiempo restante se conserva.
- El estudiante expresa su interés principal en el chat y puede cambiarlo.
- Tutor por texto; no hay conversación por voz en la primera versión.
- Actividades de vocabulario, gramática, lectura, escucha, escritura, expresión oral y pronunciación.
- Prioridad de costo mínimo, Supabase y Netlify gratuitos durante las primeras versiones mientras alcancen sus cuotas.

## Interpretaciones de implementación

El audio de lecciones y diagnóstico se mantiene; se excluyó específicamente el chat por voz. Las grabaciones locales se descartan al salir. El feedback opcional envía el fragmento al proveedor y guarda solo el texto de feedback que el usuario decida incorporar al diagnóstico.

El piloto parte de una colección inicial de 28 lecciones. Para convertirla en un curso completo se necesita ampliar unidades, objetivos, evaluaciones y revisar pedagógicamente el contenido. El diagnóstico no certifica MCER ni asigna nivel validado a respuestas abiertas.

Se usa React/TypeScript con Vite en lugar del Next.js recomendado para mantener un frontend estático y evitar un servidor permanente. La persistencia sigue en PostgreSQL y el backend en funciones de Netlify. Los repasos usan SM-2 como base inicial documentada; no se presentan como FSRS.

Los servicios no existen todavía en las cuentas del usuario. Su configuración es una dependencia real para validar el flujo completo entre dispositivos.
