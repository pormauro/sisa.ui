export const SCHEMA_VERSION = 2;

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

export const CREATE_TABLE_TRACKING_POLICY_CACHE = `
CREATE TABLE IF NOT EXISTS tracking_policy_cache (
  device_id TEXT PRIMARY KEY,
  policy_id INTEGER,
  version INTEGER,
  name TEXT,
  tracking_enabled INTEGER NOT NULL DEFAULT 0,
  tracking_profile TEXT NOT NULL DEFAULT 'disabled',
  sample_min_seconds INTEGER,
  sample_max_seconds INTEGER,
  distance_filter_m INTEGER,
  high_accuracy INTEGER,
  visit_radius_m INTEGER,
  max_batch_size INTEGER,
  next_poll_after_seconds INTEGER,
  assignment_id INTEGER,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_TABLE_GPS_POINTS_QUEUE = `
CREATE TABLE IF NOT EXISTS gps_points_queue (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy_m REAL,
  speed_mps REAL,
  heading_deg REAL,
  altitude_m REAL,
  battery_level REAL,
  is_mock INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  state TEXT,
  job_id INTEGER,
  client_candidate_id INTEGER,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  server_point_id INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(device_id, sequence_no)
);
`;

export const CREATE_INDEX_GPS_POINTS_QUEUE_DEVICE_STATUS = `
CREATE INDEX IF NOT EXISTS idx_gps_points_queue_device_status
ON gps_points_queue(device_id, sync_status, sequence_no);
`;

export const CREATE_TABLE_GPS_SYNC_STATE = `
CREATE TABLE IF NOT EXISTS gps_sync_state (
  device_id TEXT PRIMARY KEY,
  last_server_point_id INTEGER,
  last_uploaded_sequence_no INTEGER,
  last_sync_at TEXT,
  last_policy_version INTEGER,
  updated_at TEXT NOT NULL
);
`;
