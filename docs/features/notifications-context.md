# Contexto de notificaciones en la app móvil

Este documento resume cómo la app Expo consume los endpoints documentados en `docs/features/notifications.md` y en la colección de Postman para listar, marcar, ocultar y enviar notificaciones multiusuario sin depender de claves foráneas en `sisa.api`.

## Sincronización y filtros
- `NotificationsProvider` persiste la bandeja en caché con `useCachedState('notifications', [])` y reordena las entradas por `created_at`, `sent_at` o `scheduled_at` para evitar saltos visuales cuando se hidrata el estado local.【F:contexts/NotificationsContext.tsx†L223-L244】
- `loadNotifications(filters?)` construye la query string con `status`, `company_id`, `limit` y `since`, aplica siempre el encabezado `Authorization: Bearer` y valida la sesión mediante `ensureAuthResponse` antes de normalizar cualquier forma de respuesta (`notifications`, `notification`, `data`). Cuando ya existe caché para los mismos filtros y pasaron menos de 5 minutos desde la última llamada, se omite la petición salvo que se invoque con `force: true`.【F:contexts/NotificationsContext.tsx†L184-L221】【F:contexts/NotificationsContext.tsx†L246-L321】

## Operaciones expuestas
- `markAsRead(id, payload?)` ejecuta `PATCH /notifications/{id}/read`, fusiona la notificación devuelta o genera un fallback local marcándola como leída para mantener la coherencia con la bandeja actual.【F:contexts/NotificationsContext.tsx†L316-L358】
- `hideNotification(id, payload?)` consume `PATCH /notifications/{id}/hide` y reutiliza el mismo esquema de normalización para reflejar el estado `is_hidden` aun cuando el backend no retorne un objeto completo.【F:contexts/NotificationsContext.tsx†L360-L402】
- `markAllAsRead(payload?)` llama a `POST /notifications/mark-all-read`, actualiza todos los estados locales a `is_read: true` y devuelve el contador `updated_count` recibido en la respuesta.【F:contexts/NotificationsContext.tsx†L404-L434】
- `sendNotification(payload)` envía una notificación manual (superusuario) a través de `POST /notifications/send`, devuelve el `notificationId` y los `invalidUserIds` informados por la API, e incorpora la notificación a la caché si viene incluida en la respuesta.【F:contexts/NotificationsContext.tsx†L436-L469】

## Permisos y autenticación
- Todas las peticiones usan Bearer token obtenido desde `AuthContext`; si el backend responde con 401/403/419 se invoca `checkConnection` para renovar el token antes de propagar el error controlado.【F:contexts/NotificationsContext.tsx†L246-L303】
- Se añadió el grupo "Notifications" en la pantalla de permisos para exponer `listNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `hideNotification` y `sendNotifications`, alineando la UI con la colección de Postman.【F:app/permission/PermissionScreen.tsx†L19-L85】

