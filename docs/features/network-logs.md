# Monitor de solicitudes de red (APP_VERSION 1.3.7)

La pantalla **Registro de red** (`/network/logs`) muestra todas las peticiones HTTP emitidas por la app. El `NetworkLogProvider` parchea `global.fetch` para registrar cada llamada enviada mediante `loggedFetch`, incluidos los flujos de autenticación inicial, las sincronizaciones con token Bearer y cualquier uso manual del fetch global.

## Interceptado y campos guardados
- **Solicitud:** método, URL completa, cabeceras con valores sensibles enmascarados (`Authorization`/`token`) y cuerpo serializado cuando está disponible.
- **Respuesta:** código de estado, cuerpo parseado (JSON o texto) y mensaje de error si la promesa falla o expira (`timeout`).
- **Metadatos:** tiempo de inicio (`timestamp`) y duración en milisegundos para estimar latencias.

## Límites y limpieza automática
- Se conservan hasta **200 entradas** en la clave de caché `networkLogs`; al superar el límite, se descartan los registros más antiguos para ahorrar espacio.
- `useCachedState` permite rehidratar el historial tras reinicios y responde a las señales de "Borrar datos de la caché" para limpiar el listado completo en conjunto con otros contextos persistentes.
- El botón **Borrar registro** ejecuta `clearLogs()` y pide confirmación previa para evitar borrados accidentales.

## Permisos y cobertura
- El menú de Configuración muestra el acceso solo cuando el usuario tiene el permiso `listNetworkLogs`; el superusuario (`userId === '1'`) lo ve siempre.
- Todas las llamadas autenticadas se envían con token Bearer salvo el login, y el visor captura ambos tipos para depurar inicios de sesión, errores de autenticación o respuestas del backend.
