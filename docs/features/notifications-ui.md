# UI de notificaciones en la app móvil

Este documento detalla cómo la app Expo expone el módulo de notificaciones que ya contaba con contexto y endpoints documentados. El flujo respeta la autenticación por Bearer token (ya gestionada en `AuthContext`) y reutiliza el `NotificationsContext` para todas las operaciones soportadas por la API.

## Bandeja y filtros
- La pantalla `/notifications` lista las notificaciones visibles (omite las ocultas) y permite filtrar por estado: todas, no leídas o leídas. Se renderiza un chip por filtro y se disparan llamadas al backend cada vez que se cambia el estado o se hace pull-to-refresh.【F:app/notifications/index.tsx†L22-L119】【F:app/notifications/index.tsx†L187-L237】
- Se muestran severidad, estado de lectura, empresa y datos de origen (`table`, `id`, `history_id`) cuando están presentes en la respuesta normalizada por el contexto.【F:app/notifications/index.tsx†L63-L107】【F:app/notifications/index.tsx†L126-L148】
- Los botones “Marcar como leída” y “Ocultar” solo aparecen si el usuario tiene los permisos `markNotificationRead` o `hideNotification` (o es el superusuario). Ambas acciones actualizan el caché local y disparan los endpoints `PATCH /notifications/{id}/read` (enviando `read: true` y `read_at` con la fecha actual) y `PATCH /notifications/{id}/hide` respectivamente.【F:app/notifications/index.tsx†L86-L112】【F:app/notifications/index.tsx†L151-L179】【F:contexts/NotificationsContext.tsx†L315-L358】
- Si existen pendientes y el usuario posee `markAllNotificationsRead`, el CTA “Marcar N como leídas” invoca `POST /notifications/mark-all-read` enviando `company_id: 0` como valor por defecto y luego recarga el listado actual.【F:app/notifications/index.tsx†L187-L214】【F:contexts/NotificationsContext.tsx†L404-L434】

## Envío manual
- Desde la bandeja, el botón “Enviar” abre `/notifications/send` únicamente si el usuario es `id === 1` o cuenta con el permiso `sendNotifications`. Si no, se muestra un aviso de bloqueo.【F:app/notifications/index.tsx†L217-L237】【F:app/notifications/send.tsx†L43-L74】【F:app/notifications/send.tsx†L134-L168】
- El formulario solicita título y cuerpo obligatorios, admite `user_id` o `user_ids` (coma), `company_id`, severidad (`info|success|warning|error`), `source_table`, `source_id`, `source_history_id` y un `payload` JSON opcional. Los campos numéricos se normalizan a enteros o se ignoran si están vacíos.【F:app/notifications/send.tsx†L17-L74】【F:app/notifications/send.tsx†L96-L136】【F:app/notifications/send.tsx†L170-L210】
- El envío usa `sendNotification` del contexto, reporta IDs inválidos en un `Alert` y vuelve atrás si el backend devuelve `notification_id`, manteniendo la política de “sin FOREIGN KEY” definida para `sisa.api` al operar solo con identificadores.【F:app/notifications/send.tsx†L76-L136】【F:app/notifications/send.tsx†L112-L136】

## Navegación y permisos
- El módulo quedó enlazado en el menú principal dentro de la sección “Configuración y perfil” con el ícono de campana. Se requiere `listNotifications` (o superusuario) para que el acceso aparezca en el grid.【F:constants/menuSections.ts†L62-L71】
- Las acciones de lectura, ocultamiento, marcado masivo y envío manual respetan los permisos homónimos descritos en `PermissionScreen`, garantizando coherencia con la colección de Postman y el backend que exige Bearer token en todas las peticiones salvo login.【F:app/notifications/index.tsx†L132-L214】【F:app/notifications/send.tsx†L43-L136】【F:contexts/NotificationsContext.tsx†L184-L469】
