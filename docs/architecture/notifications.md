# Arquitectura de notificaciones

Este documento resume la propuesta de base de datos, servicios internos y endpoints API para gestionar notificaciones en SISA siguiendo las políticas actuales (sin claves foráneas y peticiones autenticadas con *Bearer token* excepto login). El objetivo es soportar múltiples usuarios y compañías con estados independientes por usuario.

## Modelo de datos

Se utilizan dos tablas. No se definen claves foráneas para mantener la convención de `sisa.api`.

### Tabla `notifications`

Representa el evento generado (emisión de factura, asignación de job, invitación, etc.).

```sql
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    source_table VARCHAR(64) NULL,
    source_id INT NULL,
    source_history_id INT NULL,
    payload JSON NULL,
    severity ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
    created_by_user_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_at DATETIME NULL,
    sent_at DATETIME NULL,
    expires_at DATETIME NULL,
    INDEX idx_notifications_company_created (company_id, created_at),
    INDEX idx_notifications_source (source_table, source_id),
    INDEX idx_notifications_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- `source_table` + `source_id` permiten linkear desde la UI a recursos como `/invoices/{id}` o `/jobs/{id}`.
- `payload` almacena el *snapshot* mínimo para renderizar (ej.: número de factura y cliente) evitando duplicar la entidad completa.
- `source_history_id` facilita idempotencia cuando el evento proviene de *history* (se puede complementar con índice único opcional para evitar duplicados).

### Tabla `notification_user_states`

Controla el estado de cada usuario sobre una notificación y repite `company_id` para filtrar rápido.

```sql
CREATE TABLE notification_user_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    user_id INT NOT NULL,
    company_id INT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME NULL,
    is_hidden TINYINT(1) NOT NULL DEFAULT 0,
    hidden_at DATETIME NULL,
    delivered_in_app TINYINT(1) NOT NULL DEFAULT 0,
    delivered_email TINYINT(1) NOT NULL DEFAULT 0,
    delivered_push TINYINT(1) NOT NULL DEFAULT 0,
    last_delivered_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_notification_user (notification_id, user_id),
    INDEX idx_user_unread (user_id, is_read, created_at),
    INDEX idx_company_user (company_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Beneficios**

- Multiusuario real: un evento se asigna a múltiples usuarios sin duplicarlo.
- Estado independiente por usuario (`is_read`, `is_hidden`).
- Consultas eficientes para contadores y listados.

## Servicio interno en PHP

Centraliza la creación y asignación evitando lógica duplicada en controladores.

```php
final class NotificationService
{
    public function __construct(private PDO $db) {}

    /**
     * Crea una notificación y la asigna a usuarios concretos.
     * $data incluye: company_id?, type, title, body, source_table?, source_id?, source_history_id?, payload?, severity?, created_by_user_id?
     */
    public function notifyUsers(array $userIds, array $data): int
    {
        $this->db->beginTransaction();

        $stmt = $this->db->prepare(<<<SQL
            INSERT INTO notifications (company_id, type, title, body, source_table, source_id, source_history_id, payload, severity, created_by_user_id)
            VALUES (:company_id, :type, :title, :body, :source_table, :source_id, :source_history_id, :payload, :severity, :created_by_user_id)
        SQL);

        $stmt->execute([
            ':company_id' => $data['company_id'] ?? null,
            ':type' => $data['type'],
            ':title' => $data['title'],
            ':body' => $data['body'],
            ':source_table' => $data['source_table'] ?? null,
            ':source_id' => $data['source_id'] ?? null,
            ':source_history_id' => $data['source_history_id'] ?? null,
            ':payload' => isset($data['payload']) ? json_encode($data['payload']) : null,
            ':severity' => $data['severity'] ?? 'info',
            ':created_by_user_id' => $data['created_by_user_id'] ?? null,
        ]);

        $notificationId = (int) $this->db->lastInsertId();

        $stmtState = $this->db->prepare(<<<SQL
            INSERT INTO notification_user_states (notification_id, user_id, company_id)
            VALUES (:notification_id, :user_id, :company_id)
        SQL);

        foreach ($userIds as $userId) {
            $stmtState->execute([
                ':notification_id' => $notificationId,
                ':user_id' => $userId,
                ':company_id' => $data['company_id'] ?? null,
            ]);
        }

        $this->db->commit();

        return $notificationId;
    }

    /**
     * Helper para notificar a admins de empresa.
     */
    public function notifyCompanyAdmins(int $companyId, array $data): int
    {
        $userIds = $this->getCompanyAdminUserIds($companyId);
        $data['company_id'] = $companyId;
        return $this->notifyUsers($userIds, $data);
    }

    private function getCompanyAdminUserIds(int $companyId): array
    {
        // Consultar memberships activos con rol owner/admin.
        return [];
    }
}
```

## Endpoints API

Todas las peticiones usan *Bearer token* (login excluido por las reglas actuales).

### Listado de notificaciones del usuario

```
GET /notifications?status=unread|all&company_id=...&limit=...&since=...
```

Consulta sugerida:

```sql
SELECT n.id, n.company_id, n.type, n.title, n.body, n.source_table, n.source_id, n.payload, n.severity, n.created_at, s.is_read, s.read_at, s.is_hidden
FROM notifications n
JOIN notification_user_states s ON n.id = s.notification_id
WHERE s.user_id = :current_user_id
  AND (:company_id IS NULL OR n.company_id = :company_id)
  AND (:status = 'all' OR (:status = 'unread' AND s.is_read = 0 AND s.is_hidden = 0))
ORDER BY n.created_at DESC
LIMIT :limit;
```

### Marcar como leída / no leída

- `PATCH /notifications/{id}/read` actualiza solo el estado del usuario autenticado.
- `POST /notifications/mark-all-read` permite marcar en bloque.

### Ocultar / *dismiss*

`PATCH /notifications/{id}/hide` actualiza `is_hidden` e `hidden_at` del usuario actual.

## Integración y sincronización

- Controladores de facturas, jobs y memberships deben invocar `NotificationService` luego de eventos clave (emisión, asignación, invitaciones).
- `source_history_id` permite enlazar con history y prevenir duplicados mediante índice único opcional.
- Para clientes móviles, se puede reutilizar `/sync/batch` o *polling* corto al endpoint de notificaciones.

## Consideraciones operativas

- Instalar: agregar las tablas en `install.php` y `update_install.php` de `sisa.api`, manteniendo la política de no usar `FOREIGN KEY`.
- Documentación: actualizar la colección de Postman cuando se implementen los endpoints.
- Permisos: cualquier nueva sección de UI para notificaciones debe declararse en el esquema de permisos.
