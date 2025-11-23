# Notificaciones multiusuario y multiempresa

Esta guía resume la arquitectura de base de datos, los servicios PHP y los endpoints REST que permiten emitir, listar y administrar notificaciones dentro de SISA. Todas las rutas expuestas requieren el encabezado `Authorization: Bearer <token>`; el flujo de login sigue siendo la única excepción. La base de datos `sisa.api` se mantiene sin claves foráneas, por lo que las relaciones se resuelven en la aplicación y los controladores usan únicamente identificadores.

## Modelo de datos sin claves foráneas
- `notifications`: representa el evento enviado (facturas, jobs, invitaciones) con `company_id`, `type`, `title`, `body`, `source_table`, `source_id`, `source_history_id`, `payload`, `severity`, `created_by_user_id` y marcas temporales (`created_at`, `scheduled_at`, `sent_at`, `expires_at`). Incluye índices por compañía, origen y tipo para acelerar listados.
- `notification_user_states`: mantiene el estado por usuario (`user_id`) y replica `company_id` para filtrar rápido. Almacena `is_read`, `read_at`, `is_hidden`, `hidden_at`, banderas de entrega (`delivered_in_app`, `delivered_email`, `delivered_push`) y `last_delivered_at`. El índice único `notification_id` + `user_id` evita duplicados.

Ambas tablas respetan la política de no definir FOREIGN KEY y deben agregarse en los scripts `install.php` y `update_install.php` cuando se despliegue el backend.

## Servicio interno propuesto
Un `NotificationService` en PHP centraliza la creación de eventos y su asignación a usuarios:
- `notifyUsers(array $userIds, array $data)`: inicia transacción, inserta el evento en `notifications`, crea los estados en `notification_user_states` para cada usuario y devuelve `notification_id`. `payload` se serializa a JSON y `company_id` es opcional.
- `notifyCompanyAdmins(int $companyId, array $data)`: helper para notificar a administradores de empresa; ajusta `company_id` y reutiliza `notifyUsers`.

Esta capa evita lógica duplicada en controladores y mantiene la idempotencia utilizando `source_history_id` cuando se dispara desde `history`.

## Endpoints y reglas de negocio
### Listado
- `GET /notifications?status=unread|read|all&company_id=&limit=&since=`: retorna las notificaciones del usuario autenticado. Filtra por estado y fecha (`since` en `YYYY-MM-DD HH:MM:SS`) y ordena por `created_at` descendente.
- `GET /notifications/read`: atajo para obtener únicamente las leídas, con los mismos filtros opcionales.

### Estado de lectura
- `PATCH /notifications/{id}/read`: marca como leída la notificación para el usuario actual; no permite revertir a no leído. El cuerpo acepta `read_at` opcional para registrar la marca.
- `POST /notifications/mark-all-read`: marca todas las notificaciones visibles como leídas y devuelve el número actualizado. Se puede limitar por `company_id`.

### Ocultar
- `PATCH /notifications/{id}/hide`: actualiza `is_hidden` y opcionalmente `hidden_at` para el usuario autenticado.

### Envío manual (solo superusuario)
- `POST /notifications/send`: crea una notificación manual y asigna usuarios específicos. Solo el bearer token del superusuario (`id = 1`) está autorizado; la verificación se fuerza en backend aunque exista un permiso UI `sendNotifications` para reflejar la acción.
- Requiere `title`, `body` y al menos un `user_id` (ya sea `user_id` o `user_ids`). Acepta `company_id`, `source_table`, `source_id`, `source_history_id`, `payload` y `severity` (`info|success|warning|error`).
- Respuesta `201` detalla `notification_id`, `recipients.sent_to` y `recipients.invalid_user_ids` para depurar IDs inexistentes. Errores frecuentes incluyen `400` por IDs inválidos, `403` por no ser superusuario y `404` cuando se intenta modificar notificaciones inexistentes.

## Integración con la app y permisos
- Cualquier nueva sección de la app relacionada con notificaciones debe agregarse al esquema de permisos para que los menús y botones se habiliten correctamente.
- Los controladores de facturación, trabajos y membresías pueden invocar el servicio después de sus acciones clave para mantener a usuarios y empresas informados.
- El `payload` debe contener la información mínima para renderizar CTAs o resúmenes en el cliente, mientras que `source_table` + `source_id` permiten vincular la UI a rutas como `/invoices/{id}`.

## Colección de Postman
La carpeta **Notifications** en `docs/postman/sisa-api.postman_collection.json` incluye ejemplos listos para:
- Enviar notificaciones de prueba como superusuario.
- Listar notificaciones (todas o solo leídas) con filtros.
- Marcar una notificación como leída u ocultarla.
- Marcar todas las notificaciones visibles como leídas.

Cada request está preconfigurada con autenticación Bearer (excepto login) y cuerpos de ejemplo en español para acelerar las pruebas manuales.
