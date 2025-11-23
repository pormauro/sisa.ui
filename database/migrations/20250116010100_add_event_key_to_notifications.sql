-- Agrega soporte para event_key en el módulo de notificaciones sin usar claves foráneas.

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_key VARCHAR(150) NOT NULL DEFAULT 'generic.event',
    title VARCHAR(255) NOT NULL DEFAULT '',
    body TEXT,
    action_reference VARCHAR(255),
    metadata JSON NULL,
    metadata_raw TEXT NULL,
    delivery_channel VARCHAR(50) NULL,
    is_sent TINYINT(1) NOT NULL DEFAULT 0,
    is_sent_push TINYINT(1) NOT NULL DEFAULT 0,
    sent_at DATETIME NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    delivery_error TEXT NULL,
    INDEX idx_notifications_event_key (event_key),
    INDEX idx_notifications_created_at (created_at),
    INDEX idx_notifications_sent_at (sent_at)
);

-- Ajusta instalaciones previas en las que faltaba la columna event_key.
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS event_key VARCHAR(150) NOT NULL DEFAULT 'generic.event' AFTER id,
    ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT '' AFTER event_key,
    ADD COLUMN IF NOT EXISTS body TEXT AFTER title,
    ADD COLUMN IF NOT EXISTS action_reference VARCHAR(255) AFTER body,
    ADD COLUMN IF NOT EXISTS metadata JSON NULL AFTER action_reference,
    ADD COLUMN IF NOT EXISTS metadata_raw TEXT NULL AFTER metadata,
    ADD COLUMN IF NOT EXISTS delivery_channel VARCHAR(50) NULL AFTER metadata_raw,
    ADD COLUMN IF NOT EXISTS is_sent TINYINT(1) NOT NULL DEFAULT 0 AFTER delivery_channel,
    ADD COLUMN IF NOT EXISTS is_sent_push TINYINT(1) NOT NULL DEFAULT 0 AFTER is_sent,
    ADD COLUMN IF NOT EXISTS sent_at DATETIME NULL AFTER is_sent_push,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL AFTER sent_at,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL AFTER created_at,
    ADD COLUMN IF NOT EXISTS delivery_error TEXT NULL AFTER updated_at;

CREATE TABLE IF NOT EXISTS user_notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    notification_id BIGINT UNSIGNED NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    INDEX idx_user_notifications_user (user_id),
    INDEX idx_user_notifications_notification (notification_id),
    INDEX idx_user_notifications_read (is_read)
);
