# Retiro de la foto de perfil

La interfaz ya no permite cargar ni mostrar fotos. La API `POST /api/account/avatar` y el campo `avatar_data` del registro se retiraron en esta versión; los clientes anteriores deben actualizarse. Los avatares se muestran con las iniciales del nombre.

## Datos existentes

No se borró ninguna tabla ni registro `kind='avatars'`. El endpoint de exportación de cuenta conserva esos registros para que el titular pueda obtener una copia. No hace falta ejecutar una migración para desplegar este cambio.

Si se desea eliminar las imágenes antiguas, primero realiza y verifica un respaldo de la base de datos y pide al titular que exporte sus datos. Después, una persona con acceso de administración puede borrar solo esos registros en una operación separada:

En PostgreSQL con el esquema Lingora:

```sql
DELETE FROM lingora.records WHERE kind = 'avatars';
```

En SQLite o una instalación con el esquema `public`, ejecuta `DELETE FROM records WHERE kind = 'avatars';`.

No ejecutes esa sentencia como parte de la migración automática; la eliminación es irreversible sin el respaldo.
