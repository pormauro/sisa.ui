# Monitor de solicitudes de red (APP_VERSION 1.3.6)

La pantalla **Registro de red** (`/network/logs`) permite inspeccionar las peticiones HTTP que realiza la aplicación. Usa el `NetworkLogContext` para persistir hasta 200 entradas en caché y se actualiza automáticamente cada vez que se ejecuta `loggedFetch`.

## Permisos y visibilidad
- El menú de Configuración muestra el acceso solo cuando el usuario tiene el permiso `listNetworkLogs`; el superusuario (`userId === '1'`) lo ve siempre.
- Las acciones internas no requieren permisos adicionales, pero el botón **Borrar registro** pide confirmación antes de invocar `clearLogs()` para evitar eliminaciones accidentales.

## Controles disponibles
- **Filtros**: chips para filtrar por método HTTP, categoría de estado (exitosos, errores, pendientes) y un campo de búsqueda por URI parcial.
- **Paginación**: la lista usa `FlatList` con página incremental de 20 elementos, manteniendo orden descendente por fecha.
- **Detalle expandible**: cada tarjeta revela cabeceras, cuerpo y respuesta serializados en JSON para depurar llamadas específicas.

Estas funcionalidades permiten auditar rápidamente qué endpoints se están consumiendo con token Bearer y detectar fallas sin depender de herramientas externas.
