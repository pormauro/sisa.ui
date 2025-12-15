# Monitor de solicitudes de red (APP_VERSION 1.3.7)

La pantalla **Registro de red** (`/network/logs`) muestra todas las peticiones HTTP emitidas por la app. El sniffer se importa al inicio de `app/_layout.tsx`, antes de cualquier *provider*, para parchear **`fetch` global** y **`XMLHttpRequest`** en cuanto arranca el runtime.

## Interceptado y campos guardados
- **Solicitud:** método (normalizado en mayúsculas para GET/POST/PUT/DELETE/PATCH y cualquier otro verbo), URL completa, cabeceras con valores sensibles enmascarados (`Authorization`/`token`) y cuerpo serializado cuando está disponible.
- **Respuesta:** código de estado, cuerpo parseado (JSON o texto) y mensaje de error si la promesa falla, se aborta o expira.
- **Metadatos:** tiempo de inicio (`timestamp`) y duración en milisegundos calculada entre el disparo y la finalización (`loadend`/`catch`).
- Para evitar duplicados, el sniffer omite los eventos de `XMLHttpRequest` disparados internamente por `fetch`; la comparación se realiza por método + URL para no descartar solicitudes reales que compartan endpoint con distinto verbo.

## Límites y limpieza automática
- Se conservan hasta **200 entradas** en la clave de caché `networkLogs`; al superar el límite, se descartan los registros más antiguos para ahorrar espacio.
- `useCachedState` permite rehidratar el historial tras reinicios y responde a las señales de "Borrar datos de la caché" para limpiar el listado completo en conjunto con otros contextos persistentes.
- El botón **Borrar registro** ejecuta `clearLogs()` y pide confirmación previa para evitar borrados accidentales.

## Permisos y cobertura
- El menú de Configuración muestra el acceso solo cuando el usuario tiene el permiso `listNetworkLogs`; el superusuario (`userId === '1'`) lo ve siempre.
- Todas las llamadas autenticadas se envían con token Bearer salvo el login, y el visor captura ambos tipos para depurar inicios de sesión, errores de autenticación o respuestas del backend.
