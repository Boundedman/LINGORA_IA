# Bitácora de prompts y tareas

Registro de solicitudes, ideas y cambios realizados en este proyecto.

- `[ ]` Pendiente.
- `[x]` Realizado.
- Fechas en formato `AAAA-MM-DD HH:mm:ss`, zona horaria America/Mexico_City (UTC-06:00).
- Cada entrada conserva el prompt original y un resumen breve del resultado. Marca la casilla cuando se haya completado.

## Registro

- [x] **2026-09-14 00:42:21 — Crear la bitácora**
  - **Prompt:**
    > Crea en esta carpeta una bitacora con todos los promts que te estoy pasando, junto con un resumen breve de que fue lo que hiciste o cambiaste, agrega un time stamp en cada prompt como si fuera una llista de tareas, en la cual se maneje con corchetes y seleccionando dentro de ellos si se realizo o no, esto para que yo pueda ir anotando ideas que se me vengan a la mente, el archivo de la bitacora tiene que ser .md
  - **Resumen:** Se creó `BITACORA.md` en esta carpeta con casillas de estado, fecha y hora por entrada, el prompt original y un espacio para ideas pendientes.
  - **Archivo creado:** `BITACORA.md`.

- [x] **2026-09-14 00:44:01 — Instalar la bitácora como skill global**
  - **Prompt:**
    > agrega esa skill de manera global, para que en cada proyecto que realize se cree esa bitacora
  - **Resumen:** Se instaló la skill `bitacora-proyecto` y una instrucción global para crear y mantener `BITACORA.md` en cada proyecto al trabajar con Codex, conservando prompts, timestamps, casillas y resúmenes.
  - **Archivos creados:** `C:/Users/raged/.codex/skills/bitacora-proyecto/SKILL.md` y `C:/Users/raged/.codex/AGENTS.md`.
  - **Validación:** Contenido instalado verificado contra los archivos preparados y estructura revisada. El validador Python no pudo ejecutarse porque Python no está disponible. La carga automática en una sesión nueva no se probó desde esta conversación.

- [x] **2026-09-14 00:56:24 UTC-06:00 — Recibir la idea original del proyecto**
  - **Prompt:**
    > Realice este promt con ayuda de chatGTP, con el cual plantee la idea del proyecto desde el inicio, y armamos mas a profundidad el proyecto implementando las ideas que se me venian a la mente
  - **Documento adjunto:** [Prompt original completo](PROMPT_ORIGINAL.md), conservado sin cambios.
  - **Resumen:** Se leyó la propuesta de plataforma de inglés para hispanohablantes, con tutor IA, progresión MCER, currículo, SRS y control de recursos. Se conservó el documento original en el proyecto. No se implementó código.
  - **Archivos modificados:** `BITACORA.md`; creado `PROMPT_ORIGINAL.md`.

- [ ] **2026-09-14 00:56:58 UTC-06:00 — Revisar y afinar los requisitos**
  - **Prompt:**
    > Revisar y afinar los requisitos primero
  - **Resumen:** Revisión en curso. Público inicial confirmado: grupo pequeño con niveles variados. El ingreso permitirá declarar el nivel o realizar un diagnóstico de todas las categorías. Pendiente definir cobertura curricular y criterios de validación educativa. El usuario eligió revisar los requisitos antes de construir la aplicación.
  - **Archivos modificados:** `BITACORA.md`.

- [x] **2026-09-14 00:58:06 UTC-06:00 — Definir el público inicial**
  - **Prompt:**
    > si seria para probarla con un grupo pequeño de personas
  - **Resumen:** Se confirmó que la primera versión se probará con un grupo pequeño. Cantidad de participantes y niveles de inglés aún por definir. Se actualizó el estado de la revisión; no hubo cambios de código.
  - **Archivos modificados:** `BITACORA.md`.

- [x] **2026-09-14 01:00:24 UTC-06:00 — Definir las opciones de nivel inicial**
  - **Prompt:**
    > Son niveles variados, se me ocurria que hubiera un examen diagnostico si no saben su nivel de ingles, que exista la "opción" de decir tu nivel o hacerl el examen diagnostico implementanto todas las categorias
  - **Resumen:** Se registró el requisito de ingreso con nivel declarado o diagnóstico opcional para un grupo con niveles variados. Las categorías del documento original son vocabulario, gramática, reading, listening, writing, speaking y pronunciación. Requisito documentado; todavía no implementado.
  - **Propuesta pendiente de concretar:** Distinguir nivel declarado de estimado; mostrar resultados por habilidad; permitir completar después las pruebas que necesiten micrófono, dejándolas como no evaluadas. Incluir speaking en el diagnóstico cambia su prioridad respecto al alcance secundario de voz del prompt original. El método y alcance de evaluación de pronunciación siguen pendientes.
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [x] **2026-09-14 01:01:35 UTC-06:00 — Definir duración y pausa del diagnóstico**
  - **Prompt:**
    > que pueda pausarse y que no dure mas de 15 minutos
  - **Resumen:** Se documentó que el diagnóstico debe permitir pausar y reanudar, y durar como máximo 15 minutos. Se interpreta el límite como tiempo activo de evaluación, excluyendo las pausas. Requisito registrado; todavía no implementado.
  - **Criterios propuestos:** Guardar respuestas, sección y tiempo restante; reanudar sin reiniciar el presupuesto; finalizar al alcanzar 15 minutos activos. Mostrar una estimación inicial por habilidad y señalar evidencia insuficiente cuando corresponda, sin inventar resultados para categorías no evaluadas.
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [x] **2026-09-14 01:02:47 UTC-06:00 — Definir continuidad entre dispositivos**
  - **Prompt:**
    > quiero que puedan utilizar ambos, que puedan seguir sus lecciones en donde les parezca mas comodo
  - **Resumen:** Se confirmó el uso en celular y computadora con continuidad de las lecciones mediante la misma cuenta y progreso sincronizado. Requisito documentado; todavía no implementado.
  - **Criterios propuestos:** Interfaz adaptada a cada pantalla; guardar respuestas y último paso confirmado en el servidor; retomar lecciones y diagnóstico desde otro dispositivo, conservando el tiempo restante; evitar duplicar avances o recompensas al abrir la misma actividad en ambos dispositivos. La sincronización requiere conexión a internet; uso sin conexión no definido.
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [x] **2026-09-14 01:04:22 UTC-06:00 — Identificar oportunidades adicionales en el prompt**
  - **Prompt:**
    > hay alguna area de oportunidad que veas en el promt aparte de lo ya visto? si no, comienza a trabajar en el proyecto
  - **Resumen:** Se identificaron oportunidades adicionales: concretar objetivos e intereses del onboarding; definir cómo corregir contenido educativo y reportar respuestas incorrectas; establecer criterios de éxito del piloto; fijar presupuesto operativo y comportamiento al agotarlo; definir edades de los participantes. Son propuestas pendientes de decisión, no requisitos aprobados. No se inició la implementación porque la solicitud la condiciona a no encontrar oportunidades adicionales.
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [x] **2026-09-14 01:05:19 UTC-06:00 — Definir edades del piloto y visión futura**
  - **Prompt:**
    > solo adultos pero esta planteada para que todos puedan utilizarla
  - **Resumen:** Se confirmó que el piloto será exclusivamente para adultos. La visión futura incluye usuarios de otras edades; la primera entrega no se considera habilitada para menores por esta declaración. Requisito documentado, sin implementación.
  - **Propuesta de diseño:** Separar nivel de inglés y grupo de edad para poder adaptar temas, escenarios y comportamiento del tutor independientemente. Definir la experiencia para menores antes de abrirles el acceso.
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [x] **2026-09-14 01:05:58 UTC-06:00 — Definir cantidad de participantes**
  - **Prompt:**
    > 5-10
  - **Resumen:** Se confirmó un piloto de 5 a 10 adultos con niveles variados, como referencia para dimensionar pruebas y consumo de IA. El presupuesto mensual continúa pendiente de definir.
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [x] **2026-09-14 01:08:10 UTC-06:00 — Priorizar infraestructura gratuita para el piloto**
  - **Prompt:**
    > lo menos posible, utiliza alojamientos de BD como supabase, o para el despliegue en netlify, solo para las primeras versiones
  - **Resumen:** Se confirmó minimizar gastos y priorizar planes gratuitos en las primeras versiones, tomando Supabase para base de datos y Netlify para despliegue como base prevista. Se consultaron sus páginas oficiales de precios. La infraestructura quedará portable para cambios futuros. No se crearon servicios ni se contrató ningún plan.
  - **Criterios de costo:** Objetivo de alojamiento y base de datos sin costo dentro de las cuotas gratuitas. IA y voz requieren control independiente; no se presupone que sean gratuitas ni hay un monto de gasto autorizado. Prever límites configurables, reutilización de contenido y continuidad de lecciones y repasos cuando no haya cuota de IA.
  - **Fuentes:** https://supabase.com/pricing y https://www.netlify.com/pricing/
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [x] **2026-09-14 01:10:30 UTC-06:00 — Identificar las aclaraciones finales de alcance**
  - **Prompt:**
    > gracias, que mas te gustaria aclarar?
  - **Resumen:** Se concentraron las preguntas restantes en cobertura curricular de la primera entrega, objetivo principal de aprendizaje y alcance de voz fuera del diagnóstico. Se conserva el diagnóstico con todas las categorías como requisito ya indicado. Las decisiones técnicas rutinarias se resolverán durante el desarrollo; credenciales y autorización de consumo de servicios se solicitarán cuando sean necesarias.
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [x] **2026-09-14 01:13:41 UTC-06:00 — Concretar contenido, intereses y modalidad del tutor**
  - **Prompt:**
    > para el piloto quiero que tenga lecciones hasta B2, que el usuario diga en el chat cual es su interes principal, y para la primera version no incluyas el chat por voz, añade solo lecciones para las demas areas
  - **Resumen:** Se confirmó contenido de lecciones A1, A2, B1 y B2 para el piloto. El usuario expresará su interés principal en el chat para personalizar el aprendizaje. El tutor conversacional será por texto; el chat por voz queda fuera de la primera versión. Se mantienen lecciones para las otras áreas. Requisitos registrados, todavía no implementados.
  - **Interpretación de alcance:** Excluir chat por voz no elimina el audio de listening ni el diagnóstico por habilidades previamente solicitado. Speaking y pronunciación se abordarán mediante actividades guiadas, con evaluación de audio del diagnóstico según las capacidades reales del proveedor; no mediante conversación por voz. Lecciones C1 y C2 quedan fuera del piloto.
  - **Criterio de personalización propuesto:** Guardar el interés en el perfil y permitir cambiarlo desde el chat; adaptar temas y ejemplos conservando objetivos y progresión curricular.
  - **Archivos modificados:** `BITACORA.md`. Sin cambios de código.

- [ ] **2026-09-14 01:14:55 UTC-06:00 — Desarrollar la primera versión**
  - **Prompt:**
    > muy bien, comienza el desarrollo
  - **Resumen:** Desarrollo iniciado. Se inspeccionó la carpeta: contiene la bitácora y el prompt original, sin código existente. Se preparará una aplicación React/TypeScript, Supabase y funciones de Netlify, con lecciones A1–B2 y tutor por texto. Pendiente implementación, pruebas e integración con servicios reales.
  - **Decisión técnica:** Vite para una interfaz web estática y funciones separadas, evitando un servidor permanente para el piloto. Conserva React y TypeScript recomendados en el prompt; Next.js era una recomendación, no una obligación.

## Ideas y tareas pendientes

Agrega tus ideas aquí usando esta plantilla; reemplaza la fecha y los textos cuando crees una entrada:

```markdown
- [ ] **AAAA-MM-DD HH:mm:ss — Título de la tarea**
  - **Prompt:** Escribe aquí tu solicitud o idea.
  - **Resumen:** Pendiente de realizar.
  - **Archivos modificados:** Por determinar.
```

## Criterio de registro

Se registrarán las nuevas solicitudes de esta conversación con su resultado y estado. Esta bitácora comienza con la solicitud de creación; no se dispone de prompts anteriores de trabajo en el contexto actual. Las fechas indican el momento de registro.
