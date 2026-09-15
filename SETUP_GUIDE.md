# Poner Lingora en marcha

## 1. Desarrollo local

Instala Node.js LTS (22.12+). Abre una terminal en esta carpeta, ejecuta `npm ci` y después `npm run dev`. Visita `http://127.0.0.1:5173`. Para detenerlo, pulsa Ctrl+C.

En esta sesión se descargó una copia portátil verificada de Node en `%TEMP%/lingora-node/node-v22.23.2-win-x64`. Si Node no está en PATH, en PowerShell puedes usar temporalmente:

```powershell
$env:PATH = (Join-Path $env:TEMP 'lingora-node\node-v22.23.2-win-x64') + ';' + $env:PATH
npm.cmd run dev
```

La carpeta temporal puede limpiarse; para uso habitual instala Node desde su sitio oficial.

## 2. Crear Supabase

El propietario debe crear un proyecto gratuito en Supabase. Guarda su contraseña de base de datos de forma privada. No necesitas ponerla en el frontend.

1. En el SQL Editor del proyecto nuevo, ejecuta `supabase/migrations/001_initial.sql` completo una sola vez.
2. Copia `.env.example` a `.env`. Este archivo está excluido por `.gitignore`.
3. Configura `VITE_SUPABASE_URL` y `SUPABASE_URL` con la URL HTTPS del proyecto.
4. Configura `VITE_SUPABASE_ANON_KEY` y `SUPABASE_ANON_KEY` con la clave pública anon/publishable del proyecto.
5. Configura `SUPABASE_SERVICE_ROLE_KEY` con la clave de servicio, solo en el entorno del servidor. Nunca le pongas prefijo `VITE_`.
6. Ejecuta `npm run seed`. Carga las 28 lecciones de forma idempotente.

El prefijo `VITE_` significa que una variable se publica dentro del JavaScript del navegador. Revisa estos nombres antes de desplegar.

## 3. Invitar al piloto

El alta está restringida por una lista en la base de datos. Antes de que un participante se registre, el propietario agrega su correo desde el SQL Editor:

```sql
insert into public.pilot_invites(email)
values ('correo-real-del-participante@example.com')
on conflict do nothing;
```

Sustituye el ejemplo por cada correo real y usa minúsculas. La aplicación solicita confirmación de mayoría de edad al registrarse; no pretende verificar identidad o edad documentalmente.

En Authentication, habilita email/password y configura las URLs de retorno: la local `http://127.0.0.1:5173` y, más adelante, la del sitio de Netlify. Incluye la ruta `/#account` para recuperación de contraseña. Configura y prueba el correo antes de invitar al grupo: las restricciones del servicio de correo de Supabase pueden requerir un SMTP propio. No se ha contratado uno.

Reinicia `npm run dev` después de cambiar `.env`. Crea una cuenta invitada, confirma el correo y entra. Guarda nombre y nivel o abre el diagnóstico. Completa una lección y comprueba en otro navegador que el avance se conserva.

## 4. Conectar IA, opcional para el contenido almacenado

La implementación incluye un adaptador Gemini. El usuario elige y configura una API y un modelo de texto que admita audio si quiere feedback oral. Consulta sus condiciones, disponibilidad, precios y tratamiento de datos al contratar/configurar el servicio. No hay un modelo de pago seleccionado automáticamente.

En `.env`: configura `AI_API_KEY`, `AI_MODEL`, `AI_PROVIDER=gemini` y, solamente cuando estés listo para permitir llamadas, `AI_ENABLED=true`.

Los límites diarios y por minuto se reservan atómicamente en PostgreSQL. Para detener nuevas llamadas, usa `AI_ENABLED=false` o límites de llamadas en cero. No confundas límites de llamadas con un tope monetario exacto del proveedor. Configura también controles en el proveedor. Si deseas estimaciones de costo, introduce las tarifas vigentes por millón de tokens y activa `AI_PRICE_CONFIGURED=true`; sin eso, el costo se muestra como desconocido en la base de datos.

## 5. Desplegar en Netlify

1. Ejecuta pruebas, tipos y build localmente.
2. Guarda el proyecto en el repositorio que elijas, excluyendo `.env`, `node_modules`, cachés y artefactos locales.
3. Conecta el repositorio en Netlify. El archivo `netlify.toml` define `npm run build`, salida `dist` y las funciones.
4. Configura las variables públicas para build y las privadas para las funciones. No subas `.env`.
5. Publica cuando hayas revisado el resultado y quieras abrir el acceso al piloto.
6. Añade el dominio de Netlify a las URLs permitidas de Supabase Auth y prueba registro, correo, recuperación, RLS, progreso y tutor desde ese dominio.

No basta subir `dist` por sí solo: también se necesitan las funciones y las variables del servidor para tutor, exportación y eliminación de cuenta.

## Problemas habituales

- **“Cuentas todavía no conectadas”**: faltan variables públicas o no se reinició Vite.
- **Registro rechazado**: revisa la invitación en minúsculas y los correos de confirmación.
- **“Catálogo aún no cargado”**: ejecuta la migración y `npm run seed`.
- **Conflicto de progreso**: se editó la misma actividad en otro dispositivo. Recarga y continúa desde la versión guardada.
- **Tutor deshabilitado**: revisa las variables privadas, la cuota y `AI_ENABLED`. No publiques las claves para diagnosticarlo.
- **No se escucha audio**: revisa volumen y voces en inglés del navegador. La reproducción usa la síntesis del dispositivo y puede variar.
- **Micrófono bloqueado**: requiere HTTPS o localhost y permiso explícito del navegador.
- **Supabase inactivo**: comprueba si el proyecto gratuito está pausado.
- **Error EPERM en el entorno del agente**: los ejecutores necesitan permiso para iniciar subprocesos; no indica por sí mismo un fallo del proyecto.
