# Interfaz móvil y temas

La cabecera incluye **Tema de la aplicación** con Claro, Oscuro y Sistema. Se guarda la elección en `localStorage` bajo `lingora-theme`. Sistema responde a `prefers-color-scheme`, incluidos cambios con la aplicación abierta. Las pestañas abiertas sincronizan cambios de preferencia mediante el evento `storage`. Si el navegador bloquea el almacenamiento, el control funciona durante esa visita.

`front/public/theme-init.js` se ejecuta en la cabecera HTML antes de la aplicación y sus estilos. Aplica la preferencia, `color-scheme` y el color de la barra del navegador. Las paletas semánticas viven en `front/src/theme.css`; la paleta oscura conserva violetas, azules y menta con fondos propios. Las pruebas calculan contraste mínimo 4.5:1 para texto, botones, errores, estados deshabilitados y avisos con sus fondos semánticos.

## Distribución

- Navegación en panel lateral a partir del ancho compacto o de una ventana horizontal de poca altura. Conserva las siete opciones y sus nombres completos; se cierra al navegar, con el control de cierre, con Escape o al tocar el fondo. Gestiona el foco y el desplazamiento del panel.
- Cuadrículas con `minmax(0,…)` o columnas automáticas acotadas al ancho del contenedor. Los elementos flexibles pueden reducir su ancho y el texto puede ocupar varias líneas. Las estadísticas dejan de repartirse en tres columnas estrechas en teléfonos.
- Cabecera y acciones admiten varias líneas. El acceso al diagnóstico permanece disponible en el inicio. La ilustración del inicio ocupa su propio espacio en móvil, en lugar de superponerse al texto.
- Controles de al menos 44 píxeles; campos con tipografía de 1 rem para evitar la reducción de texto de la versión anterior. Radios y casillas conservan controles compactos dentro de etiquetas táctiles de 44 píxeles o más.
- Formularios emergentes desplazables y acotados a `visualViewport`, con zonas seguras. Al reducirse la ventana visible, el campo activo se desplaza al área disponible. Los diálogos mantienen el foco, se cierran con Escape y devuelven el foco al control previo.
- Tutor por texto con mensajes en el flujo vertical del documento y campos flexibles. Tutor por voz con estado visible en el bloque de controles durante la sesión y acción principal adherida al borde inferior disponible; sin la antigua barra inferior de navegación. Conserva el comportamiento de iniciar/finalizar implementado anteriormente.

Las reglas de distribución están en `front/src/responsive.css`. Las decoraciones pueden recortarse dentro de su ilustración; no se usa `overflow-x:hidden` sobre la aplicación para ocultar desbordamientos de contenido.

## Validación realizada y pendiente

Pruebas automatizadas con JSDOM: persistencia del tema, restauración inicial previa a React, reacción al sistema, sincronización de pestañas, navegación y foco del menú en tamaños simulados de 320/360/390/430, alturas verticales y horizontales, cierre por Escape y foco de formularios. Se mantiene la cobertura de cuenta, lecciones, glosario, diagnóstico, tutor y voz.

**JSDOM no calcula la distribución visual.** Los tamaños simulados verifican el comportamiento, no demuestran ausencia de recortes. No hay navegador conectado a las herramientas de esta sesión. Queda pendiente revisar cada pantalla en ambos temas a 320, 360, 390 y 430 píxeles, orientación vertical y horizontal, aumento del texto al 200 %, teclado real en Android/iOS y zonas seguras de dispositivos. Comprobar especialmente formularios de registro/cuenta/recuperación, diagnóstico activo, transcripciones largas y el control adherido de voz.

Los cambios están preparados localmente; este trabajo no publica ni despliega la aplicación.
