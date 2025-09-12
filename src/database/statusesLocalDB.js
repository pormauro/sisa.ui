import * as SQLite from 'expo-sqlite';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalStatusesTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS statuses (
        id INTEGER PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        value TEXT NOT NULL,
        background_color TEXT,
        order_index INTEGER,
        version INTEGER NOT NULL DEFAULT 1
      );
    `);
    const columns = await db.getAllAsync('PRAGMA table_info(statuses);');
    const hasVersion = columns.some(c => c.name === 'version');
    if (!hasVersion) {
      await db.execAsync('ALTER TABLE statuses ADD COLUMN version INTEGER NOT NULL DEFAULT 1;');
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertStatusLocal(statusData) {
  const { id, label, value, background_color, order_index, version = 1 } = statusData;
  try {
    let result;
    if (id !== undefined && id !== null) {
      result = await db.runAsync(
        `INSERT INTO statuses (id, label, value, background_color, order_index, version)
         VALUES (?, ?, ?, ?, ?, ?);`,
        id,
        label,
        value,
        background_color,
        order_index,
        version
      );
      return id;
    } else {
      result = await db.runAsync(
        `INSERT INTO statuses (label, value, background_color, order_index, version)
         VALUES (?, ?, ?, ?, ?);`,
        label,
        value,
        background_color,
        order_index,
        version
      );
      return result.lastInsertRowId;
    }
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function updateStatusLocal(id, statusData) {
  const { label, value, background_color, order_index, version = null } = statusData;
  try {
    const result = await db.runAsync(
      `UPDATE statuses SET label = ?, value = ?, background_color = ?, order_index = ?, version = COALESCE(?, version) WHERE id = ?;`,
      label,
      value,
      background_color,
      order_index,
      version,
      id
    );
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

export async function getAllStatusesLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM statuses;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function deleteStatusLocal(id) {
  try {
    const result = await db.runAsync('DELETE FROM statuses WHERE id = ?;', id);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

export async function clearLocalStatuses() {
  try {
    await db.execAsync('DELETE FROM statuses;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}
