---
name: lingora-push-dual
description: Publica el proyecto LINGORA en Lingora-IA/LINGORA-IA-V2 y Boundedman/LINGORA_IA cuando el usuario pide hacer push, subir cambios o actualizar GitHub en este proyecto.
---

# Push de LINGORA a ambos repositorios

La preferencia del usuario es publicar el mismo commit en `main` de ambos destinos:

- Organización: https://github.com/Lingora-IA/LINGORA-IA-V2.git
- Personal, conectado a Cloudflare: https://github.com/Boundedman/LINGORA_IA.git

Aplicar solo a este proyecto y cuando el usuario solicite publicar. No publicar por el mero hecho de editar archivos. Una instrucción explícita que limite los destinos prevalece.

1. Revisar la rama, el estado y las URL de los remotos. `origin` corresponde a la organización y `personal` al repositorio personal. Si falta `personal`, agregarlo con la URL anterior; no cambiar un remoto que apunte a otro destino sin investigar.
2. Consultar y traer `main` de ambos destinos. Revisar cualquier divergencia antes de publicar; no usar force ni eliminar ramas, etiquetas o repositorios. La sustitución inicial del contenido personal ya se hizo conservando ambos historiales; no repetirla en futuros pushes.
3. Actualizar BITACORA.md según las instrucciones del proyecto. Revisar los cambios a incluir y preparar un commit si hace falta. Excluir secretos, `.env`, dependencias, compilados y repositorios anidados. No usar `git add .` sin revisar los archivos. Para cambios de código ejecutar las comprobaciones pertinentes; una publicación sin cambios nuevos de código puede conservar la validación previa, indicando su alcance.
4. Publicar secuencialmente el mismo commit: `git push origin HEAD:main` y `git push personal HEAD:main`. La solicitud de push autoriza ambos destinos. Si hay cambios remotos concurrentes, investigar y resolver conservando el trabajo; no forzar para saltar el rechazo.
5. Verificar con `git ls-remote <URL> refs/heads/main` que ambos SHA coinciden con el commit publicado. Si uno falla, informar cuál se actualizó y cuál falta; reintentar solo tras resolver la causa. No afirmar éxito doble sin verificar ambos.
6. Actualizar la bitácora con el resultado real. Si se publica un commit adicional del registro, enviarlo también a ambos destinos y verificarlo. Informar commit y estado de cada repositorio. El push puede activar Cloudflare, pero no confirma un despliegue correcto; revisar su estado aparte cuando se solicite.

Si falla la red del sandbox, usar el mecanismo disponible de acceso ampliado. Si falla la autenticación, informar el bloqueo sin imprimir credenciales.
