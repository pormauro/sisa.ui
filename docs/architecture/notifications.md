# Arquitectura de notificaciones

Este documento reinicia la especificación de base de datos, servicios internos y endpoints API para notificaciones en SISA. Todas las rutas continúan protegidas con *Bearer token* (solo el login está exento) y la base de datos de `sisa.api` mantiene la política de **no usar `FOREIGN KEY`**.

## 1. Modelo de datos

Se definen dos tablas sin claves foráneas: una para el evento y otra para el estado por usuario.

### Tabla `notifications`

Representa el evento generado (emisión de factura, asignación de job, etc.).

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

- `source_table` + `source_id` permiten linkear al recurso `/invoices/{id}` o `/jobs/{id}` desde la UI.
- `payload` guarda el *snapshot* mínimo para renderizar (número de factura, cliente, título de job) sin duplicar la entidad completa.
- `source_history_id` facilita idempotencia cuando el evento proviene de `history` (se puede complementar con índice único si se quiere evitar duplicados).

### Tabla `notification_user_states`

Controla el estado por usuario y mantiene redundancia de `company_id` para filtrar rápido.

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

## 2. Servicio interno en PHP

Centraliza la creación y asignación de notificaciones, evitando lógica repetida en controladores. La interfaz propuesta sigue el estilo actual de servicios de dominio.

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
     * Ejemplo de helper para notificar a admins de empresa.
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

## 3. Endpoints API

Autenticación: todas las peticiones usan Bearer token; solo login queda excluido por las reglas actuales.

### 3.1. Listado de notificaciones del usuario

`GET /notifications?status=unread|read|all&company_id=...&limit=...&since=...`

`GET /notifications/read?company_id=...&limit=...&since=...` devuelve únicamente las notificaciones leídas del usuario autenticado.

Consulta sugerida:

```sql
SELECT n.id, n.company_id, n.type, n.title, n.body, n.source_table, n.source_id, n.payload, n.severity, n.created_at, s.is_read, s.read_at, s.is_hidden
FROM notifications n
JOIN notification_user_states s ON n.id = s.notification_id
WHERE s.user_id = :current_user_id
  AND (:company_id IS NULL OR n.company_id = :company_id)
  AND (
    :status = 'all'
    OR (:status = 'unread' AND s.is_read = 0 AND s.is_hidden = 0)
    OR (:status = 'read' AND s.is_read = 1 AND s.is_hidden = 0)
  )
ORDER BY n.created_at DESC
LIMIT :limit;
```

### 3.2. Marcar como leída

- `PATCH /notifications/{id}/read` marca solo el estado del usuario autenticado y no permite revertir a no leído.
- `POST /notifications/mark-all-read` permite marcar en bloque todas las notificaciones visibles como leídas.

### 3.3. Ocultar / dismiss

`PATCH /notifications/{id}/hide` actualiza `is_hidden` e `hidden_at` del usuario actual.

### 3.4. Envío manual para pruebas (solo superusuario)

`POST /notifications/send`

- **Autorización**: exige Bearer token; únicamente el usuario `id = 1` puede ejecutarlo.
- **Permiso**: `sendNotifications` queda disponible como permiso global para que la UI pueda referenciarlo, aunque el backend fuerza la verificación de superusuario.
- **Body**:
  ```json
  {
    "title": "Texto visible en la campana",
    "body": "Detalle o CTA",
    "type": "manual",
    "severity": "info|success|warning|error",
    "user_ids": [2, 3],
    "company_id": 10,
    "source_table": "invoices",
    "source_id": 99,
    "source_history_id": 101,
    "payload": {"cta": "/invoices/99"}
  }
  ```
- **Validaciones**: requiere `title`, `body` y al menos un `user_id`. Se filtran los IDs inexistentes y se informan en la respuesta para depurar.
- **Respuesta 201**: incluye `notification_id`, `recipients.sent_to` y `recipients.invalid_user_ids` para facilitar pruebas de conectividad.

## 4. Integración y sincronización

- Los controladores de facturas, jobs y memberships pueden llamar al `NotificationService` después de cambios clave (emisión, asignación, invitaciones).
- `source_history_id` sirve para enlazar con `history` y evitar duplicados mediante índice único opcional.
- Si se desea sincronizar con el cliente móvil, las notificaciones pueden incluirse en `/sync/batch` o consultarse vía endpoint con *polling* corto.

## 5. Consideraciones operativas

- Instalar: agregar las tablas en `install.php` y `update_install.php` manteniendo la política sin claves foráneas.
- Documentación: incluir los endpoints nuevos en la colección de Postman del servidor cuando se implementen.
- Permisos: cualquier nueva sección en la UI asociada a notificaciones debe agregarse en el esquema de permisos correspondiente.
