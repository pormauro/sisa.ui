export const SCHEMA_VERSION = 1;

export const CREATE_TABLE_FILES = `
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  checksum TEXT,
  local_path TEXT,
  downloaded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
`;

export const CREATE_INDEX_FILES_DOWNLOADED = `
CREATE INDEX IF NOT EXISTS idx_files_downloaded
ON files(downloaded);
`;

export const CREATE_TABLE_ENTITY_FILES = `
CREATE TABLE IF NOT EXISTS entity_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  position INTEGER,
  UNIQUE(entity_type, entity_id, file_id)
);
`;

export const CREATE_INDEX_ENTITY_FILES = `
CREATE INDEX IF NOT EXISTS idx_entity_files_entity
ON entity_files(entity_type, entity_id);
`;
