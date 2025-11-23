# Esquema de notificaciones en `sisa.api`

La API usa dos tablas sin claves foráneas para mantener compatibilidad con instalaciones existentes:

- `notifications`: almacena el evento original que se envía a uno o varios usuarios. Contiene metadatos, payloads JSON y banderas de envío (`is_sent`, `is_sent_push`).
- `user_notifications`: vincula cada notificación con un usuario y guarda el estado de lectura.

## Script de instalación/actualización

Ejecuta la migración `database/migrations/20250116010100_add_event_key_to_notifications.sql` en el servidor MySQL para crear o ajustar las tablas según sea necesario. El script:

- Crea `notifications` con la columna obligatoria `event_key` (valor por defecto `generic.event`), campos de título/cuerpo y metadatos JSON.
- Garantiza que instalaciones previas añadan `event_key` y los campos relacionados mediante `ALTER TABLE ... IF NOT EXISTS` sin usar `FOREIGN KEY`.
- Crea `user_notifications` con índices para búsquedas por usuario, notificación y estado de lectura.

## Índices recomendados

- `idx_notifications_event_key`: optimiza filtros por `event_key` utilizados en el Centro de notificaciones.
- `idx_notifications_created_at` y `idx_notifications_sent_at`: ayudan a ordenar cronológicamente.
- `idx_user_notifications_user`, `idx_user_notifications_notification`, `idx_user_notifications_read`: aceleran listados por usuario y banderas de lectura.

## Consideraciones

- Todas las operaciones del módulo siguen usando `Authorization: Bearer <token>` como exige `sisa.api`.
- Evitamos `FOREIGN KEY` para alinear el esquema con el resto de la instalación; las relaciones se resuelven en la capa de aplicación.
