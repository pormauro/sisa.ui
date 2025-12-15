import * as SQLite from 'expo-sqlite/next';

export type DatabaseHandle = SQLite.SQLiteDatabase;

let database: DatabaseHandle | null = null;
let initializationPromise: Promise<DatabaseHandle> | null = null;

const ensureMigrations = async (db: DatabaseHandle): Promise<void> => {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  await db.execAsync(`
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
  `);

  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_files_downloaded ON files(downloaded);'
  );
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_files_updated_at ON files(updated_at);'
  );

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS entity_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      file_id INTEGER NOT NULL,
      position INTEGER,
      UNIQUE(entity_type, entity_id, file_id)
    );
  `);
};

export const initializeDatabase = async (): Promise<DatabaseHandle> => {
  if (database) {
    return database;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      const db = SQLite.openDatabaseSync('sisa.db');
      await ensureMigrations(db);
      database = db;
      return db;
    })();
  }

  return initializationPromise;
};

export const getDatabase = async (): Promise<DatabaseHandle> => {
  if (database) {
    return database;
  }
  return initializeDatabase();
};
