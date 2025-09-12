ALTER TABLE sync_items
    ADD UNIQUE KEY unique_hash (hash);
