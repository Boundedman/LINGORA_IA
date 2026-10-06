# Lingora · Prototipo monolítico

FastAPI sirve la interfaz React y la API desde un proceso; PostgreSQL de Supabase guarda cuentas y actividades cuando se configura DATABASE_URL; sin ella se usa SQLite. Se conservan el diseño y las 28 lecciones A1–B2.

El tutor incluye modalidades **Por texto** y **Por voz** (Gemini Live, activación configurable). Consulta [configuración, privacidad y pruebas de voz](docs/VOICE_TUTOR.md). La clave permanece en FastAPI; el micrófono se solicita únicamente al iniciar una práctica.

## Organización

- [front/](front/README.md): interfaz, estilos, catálogo y pruebas React.
- [back/](back/README.md): Python, API, autenticación, aprendizaje, PostgreSQL/SQLite y Gemini.
- [docs/](docs/README.md): instalación, arquitectura, datos, alcance y propuesta original.
- [scripts/](scripts/README.md): exportación del catálogo y lanzador Python.
- [data/](data/README.md): base SQLite privada, no código.
- [legacy/](legacy/README.md): implementación anterior Supabase/Netlify.
- [artifacts/](artifacts/README.md): resultados temporales y cachés.
- [LINGORA_IA/](LINGORA_IA/README.md): repositorio Git anidado preexistente, sin las fuentes actuales.

Cada carpeta de código propio tiene README con contenido y funcionamiento. Dependencias y carpetas generadas se explican desde su carpeta principal, sin modificar paquetes de terceros.

## Archivos de la raíz

- `package.json` y `package-lock.json`: comandos comunes y dependencias JavaScript; ejecuta los comandos desde esta raíz.
- `.env`: configuración privada, incluida la clave IA; excluida de Git.
- `.env.example`: plantilla sin secretos.
- `.gitignore`: exclusiones de datos, secretos, dependencias y archivos generados.
- `netlify.toml`: compila desde la raíz y publica `front/dist` en Netlify (solo interfaz).
- [BITACORA.md](BITACORA.md): solicitudes y resultados; conserva las rutas que tenían los archivos en cada fecha.
- `.venv/` y `node_modules/`: dependencias instaladas. Se regeneran siguiendo la guía de instalación; no se editan manualmente ni se trasladan porque contienen rutas internas.
- `.npm-cache/`: caché local existente de npm, sin código propio.

## Arranque

Con las dependencias instaladas:

```powershell
npm run build
npm start
```

Abre http://127.0.0.1:8000. También puedes ejecutar `.venv\Scripts\python.exe -m uvicorn back.main:app --host 127.0.0.1 --port 8000`.

Para instalar desde cero, sigue [SETUP_GUIDE.md](docs/SETUP_GUIDE.md). Node se necesita para compilar o editar; el monolito compilado se ejecuta con Python.

## Publicación de la interfaz en Netlify

**Destino actual: Cloudflare.** Sigue [CLOUDFLARE.md](docs/CLOUDFLARE.md)
para publicar la web con `wrangler.jsonc` y conectar FastAPI. La configuración
Netlify que se describe abajo queda como referencia de la publicación anterior.

La configuración raíz `netlify.toml` usa `npm run build` y publica `front/dist`.
Vite tiene `front/` como raíz: el `dist/` que muestra en su salida corresponde a
`front/dist`, no a una carpeta en la raíz del repositorio. Sube este archivo al
repositorio conectado y vuelve a desplegar. El directorio base debe ser la raíz
del proyecto, donde está `package.json`.

Esto resuelve la ruta de publicación, pero no despliega FastAPI. Las cuentas,
fotos, progreso y tutor necesitan el backend Python y las rutas `/api`.
Para publicar la aplicación completa se necesita alojar FastAPI y configurar
su conexión con la interfaz, incluidas las cookies y la validación de origen.
La conexión a Supabase por sí sola no sustituye ese servidor. La configuración
histórica de `legacy/netlify.toml` no corresponde a esta versión.

La guía [Conectar Netlify con FastAPI](docs/NETLIFY_BACKEND.md) explica cómo
publicar el backend con `render.yaml`, configurar las variables y conectar `/api`.

## Verificación

```powershell
npm run lint
npm test
npm run test:backend
npm run test:legacy
```

Las pruebas históricas se ejecutan por separado. `npm run dev:api` y `npm run dev:ui` permiten trabajar con recarga. Gemini y SMTP dependen de configuración privada; las lecciones y el progreso funcionan sin ellos.

El vocabulario ofrece enlaces de consulta a Cambridge como recurso externo independiente. La [skill reutilizable](docs/skills/lingora-cambridge/SKILL.md) guía su uso durante el desarrollo y la creación de contenido original; no conecta automáticamente el tutor a Cambridge ni añade una API.

También puedes abrir **Glosario** para consultar 64 palabras y expresiones originales dentro de LINGORA. Sus 8 secciones incluyen traducción, uso y ejemplos, con búsqueda bilingüe y filtros A1–B2. Funciona sin cuenta y sin llamadas a Cambridge o Gemini; las prácticas libres no modifican tu progreso. El contenido editable está en [glossary.ts](front/src/data/glossary.ts).
