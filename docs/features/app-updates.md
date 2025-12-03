# Actualizaciones móviles

La app consulta `GET /app_updates/latest?current_version=<versión>` con el token Bearer para saber si hay una build más reciente.
El `AppUpdatesProvider` usa `PermissionsContext` para respetar el permiso `listAppUpdates`, almacena la última respuesta en
`useCachedState` y vuelve a consultar cuando hay token disponible. El estado expone `updateAvailable`, `latestUpdate`, la
`currentVersion` tomada de la configuración de Expo y la marca `lastCheckedAt` para depuración.【F:contexts/AppUpdatesContext.tsx†L6-L110】

En el menú principal, la pantalla `Home` vuelve a ejecutar la verificación al enfocarse y, si hay una versión nueva, muestra
un botón destacado que indica el número de la versión disponible e inicia la descarga usando el `download_url` devuelto por la API.【F:app/Home.tsx†L16-L87】【F:app/Home.tsx†L94-L127】

## Notas de versión
- **1.4.1:** se normaliza el envío de fechas en formato ISO con zona horaria (`2025-12-02T15:00:00-03:00`) para alinear el cliente con respuestas del backend en UTC. Actualiza la app para evitar desfases horarios en registros de pagos y recibos.
