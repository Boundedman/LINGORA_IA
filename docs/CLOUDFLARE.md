# Publicar Lingora en Cloudflare

La web se publica en **Workers con Static Assets**. FastAPI sigue en un servicio
Python (el `render.yaml` existente prepara Render) y los datos en Supabase.
No se ha portado el backend Python a Python Workers.

## 1. Publicar la web

Sube los cambios al repositorio. En Cloudflare, abre Workers & Pages, crea una
aplicación Worker e importa ese repositorio. Configura:

- Directorio raíz: raíz del repositorio.
- Build command: `npm run build`.
- Deploy command: `npx wrangler@4 deploy`.
- Node: 22 o superior compatible con Vite.

`wrangler.jsonc` indica `front/dist` como directorio de archivos estáticos.
No uses `dist` en la raíz ni el comando `wrangler pages deploy`.
Cloudflare asignará una URL `https://lingora.<tu-cuenta>.workers.dev`.

## 2. Publicar FastAPI y conectar

En Render crea un Blueprint con el mismo repositorio y `render.yaml`:

- `DATABASE_URL`: conexión Supabase de tu `.env`, con SSL.
- `APP_URL`: URL HTTPS exacta de Cloudflare, sin rutas.
- `AI_MODEL` y `AI_API_KEY`: valores actuales del backend.
- `COOKIE_SECURE=true` ya está configurado.

Cuando `https://TU-BACKEND.onrender.com/api/health` responda correctamente,
coloca ese origen (sin `/api`) en `vars.BACKEND_URL` de `wrangler.jsonc` y
vuelve a desplegar Cloudflare. Esa URL es pública, no es una contraseña.
Las claves privadas permanecen en Render.

Comprueba en la URL de Cloudflare `/api/health`, registro, inicio de sesión,
perfil y tutor. La interfaz mantiene las solicitudes `/api` en su propio dominio;
el Worker las envía a FastAPI. No hace falta abrir CORS a todos los orígenes.
Si cambias el dominio, actualiza `APP_URL` en el backend.

Render Free puede suspenderse por inactividad y bloquear los puertos SMTP
habituales. La recuperación por correo necesita un alojamiento compatible o
una adaptación del envío a una API.

## 3. Sustituir la publicación anterior

Tras verificar Cloudflare, puedes dejar de utilizar la URL Netlify y desactivar
sus despliegues automáticos. Los archivos Netlify se conservan como referencia;
Cloudflare utiliza `wrangler.jsonc`. No se ha borrado el sitio remoto anterior.

Documentación oficial:
https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
https://developers.cloudflare.com/workers/wrangler/configuration/
