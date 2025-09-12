CREATE TABLE IF NOT EXISTS sync_batches (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(255) NOT NULL UNIQUE,
    payload JSON NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS sync_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(255) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    hash CHAR(32) NOT NULL,
    payload JSON NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY unique_hash (hash)
);

CREATE TABLE IF NOT EXISTS sync_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity VARCHAR(50) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    batch_id VARCHAR(255) NOT NULL,
    payload JSON NULL,
    snapshot JSON NULL,
    created_at TIMESTAMP NULL
);
