import * as SQLite from 'expo-sqlite';
import { MIGRATIONS, SCHEMA_VERSION } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('sisa.db');
  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = OFF;
  `);

  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );

  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    await runMigrations(database, currentVersion);
  }
}

async function runMigrations(
  database: SQLite.SQLiteDatabase,
  fromVersion: number
) {
  await database.execAsync('BEGIN');

  try {
    for (const migration of MIGRATIONS) {
      if (migration.version > fromVersion) {
        for (const statement of migration.statements) {
          await database.execAsync(statement);
        }
      }
    }

    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    await database.execAsync('COMMIT');
  } catch (error) {
    await database.execAsync('ROLLBACK');
    throw error;
  }
}
