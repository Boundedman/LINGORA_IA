# Lingora

Plataforma web de práctica de inglés para un piloto de 5–10 adultos hispanohablantes. React, TypeScript, Vite, Supabase y funciones de Netlify. Lecciones originales A1–B2, tutor por texto, diagnóstico pausable y progreso por cuenta.

## Estado real

Primera implementación local. El catálogo y los ejercicios se pueden explorar sin servicios. El guardado entre dispositivos, autenticación y repasos persistentes requieren configurar Supabase y aplicar migración y seed. La IA requiere una API Gemini configurada; está apagada por defecto. No se han creado cuentas externas ni desplegado el proyecto.

El catálogo contiene 28 lecciones iniciales (una por habilidad y nivel), no un currículo exhaustivo. El diagnóstico es una orientación breve y experimental: las actividades abiertas reciben feedback opcional, sin nivel MCER validado. La pronunciación precisa y la certificación no están implementadas. No hay chat por voz.

## Ejecutar

Requiere Node.js 22.12 o superior. Desde esta carpeta:

```sh
npm ci
npm run dev
```

Abre `http://127.0.0.1:5173`. El mismo comando levanta la API local en `127.0.0.1:8787`. Sin `.env` se puede explorar el contenido, sin simular cuentas ni progreso remoto.

```sh
npm test
npm run test:db
npm run lint
npm run build
```

Las pruebas SQL utilizan PostgreSQL embebido con PGlite y un esquema de autenticación de prueba; no reemplazan una prueba de integración real con Supabase Auth, correo y dos dispositivos.

## Documentación

- [Guía de instalación](SETUP_GUIDE.md)
- [Arquitectura](ARCHITECTURE.md)
- [Base de datos](DATABASE.md)
- [Sistema de IA](AI_SYSTEM.md)
- [Optimización de recursos](TOKEN_OPTIMIZATION.md)
- [Datos y contenido](DATASETS.md)
- [Mapa del proyecto](PROJECT_MAP.md)
- [Alcance acordado](docs/ALCANCE.md)
- [Pendientes antes del piloto](docs/PENDIENTES.md)
- [Bitácora de solicitudes](BITACORA.md)

## Diseño operativo

La interfaz es estática; las operaciones privilegiadas viven en funciones. Supabase Auth gestiona contraseñas y sesiones. PostgreSQL mantiene la verdad sobre avances y cuotas. La aplicación usa IA para feedback abierto y conversación, y código para corregir opciones, programar repasos y calcular estadísticas.

El plan gratuito es una meta de infraestructura, no una garantía de disponibilidad o consumo ilimitado. Las cuotas de alojamiento, el correo y los proveedores de IA deben revisarse al conectar las cuentas. No se activan pagos desde el código.
