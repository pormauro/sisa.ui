import * as SQLite from 'expo-sqlite';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalPermissionsTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY NOT NULL,
        user_id INTEGER,
        sector TEXT NOT NULL
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertPermissionLocal(permission) {
  const { id, user_id, sector } = permission;
  try {
    await db.runAsync(
      'INSERT OR REPLACE INTO permissions (id, user_id, sector) VALUES (?, ?, ?);',
      id,
      user_id,
      sector
    );
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function deletePermissionLocal(id) {
  try {
    await db.runAsync('DELETE FROM permissions WHERE id = ?;', id);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function clearPermissionsByUserLocal(userId) {
  try {
    await db.runAsync('DELETE FROM permissions WHERE user_id = ?;', userId);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function getPermissionsByUserLocal(userId) {
  try {
    const result = await db.getAllAsync(
      'SELECT id, sector FROM permissions WHERE user_id = ?;',
      userId
    );
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}
