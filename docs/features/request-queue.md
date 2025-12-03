# Monitor de cola de peticiones

La app incluye una vista exclusiva para el super usuario (ID = 1) que muestra las peticiones HTTP capturadas en tiempo real. El `RequestQueueProvider` envuelve a toda la aplicación y reemplaza `global.fetch` para registrar cada solicitud con su método, URL, instante de inicio y resultado (éxito, error o abortada), conservando hasta 200 entradas en memoria y en caché persistente mediante `useCachedState`.【F:contexts/RequestQueueContext.tsx†L1-L155】

La pantalla `/settings/request-queue` ordena la cola de más reciente a más antigua, muestra contadores de pendientes, total de registros y la última actividad, y permite limpiar el historial local. Si el usuario no es el maestro, se redirige al menú principal para evitar accesos no autorizados.【F:app/settings/request-queue.tsx†L1-L207】

El acceso en el menú principal exige el permiso `viewRequestQueue`, aunque el super usuario siempre la verá. Añade este permiso al configurar perfiles personalizados desde la pantalla de permisos para habilitar el diagnóstico a otros roles de soporte.【F:constants/menuSections.ts†L106-L127】【F:app/permission/PermissionScreen.tsx†L19-L45】
