# Registro de peticiones HTTP (v1.3.6)

Desde la versión 1.3.6 la aplicación captura automáticamente todas las peticiones al servidor. Cada llamada interceptada incluye:

- URL y método HTTP.
- Cuerpo de la solicitud serializado cuando está disponible.
- Fecha y hora exactas de envío.
- Estado HTTP y cuerpo de la respuesta (o el mensaje de error si la llamada falla).

La instrumentación se realiza en un *provider* global que envuelve al árbol de navegación y reemplaza `fetch` para persistir el historial en caché, conservando hasta 200 elementos y recortando los más antiguos para evitar crecimientos indefinidos.【F:contexts/RequestLogsContext.tsx†L1-L138】【F:app/_layout.tsx†L60-L117】 Esto permite que el registro sobreviva reinicios y funcione como bitácora de diagnóstico sin intervención del usuario.

## Consulta y limpieza desde Configuración

En `Configuración` se añadió la sección **Registro de peticiones**, donde se listan las llamadas más recientes en orden descendente, mostrando su marca temporal, cuerpo enviado y cuerpo de la respuesta. El botón **Borrar historial de peticiones** elimina el historial completo tanto de memoria como de caché.【F:app/user/ConfigScreen.tsx†L262-L308】 El resto de botones de la pantalla siguen ofreciendo la limpieza de caché general y de archivos.

## Versionado

Actualiza `APP_VERSION` a `1.3.6` para reflejar la incorporación de este registro de auditoría dentro de la aplicación.【F:config/Index.ts†L1-L3】 Incluye la referencia en notas de versión o material de despliegue cuando corresponda.
