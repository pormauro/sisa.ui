import * as SQLite from 'expo-sqlite';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalConfigTable() {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT,
        view_type TEXT,
        theme TEXT,
        font_size TEXT
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function saveConfigLocal(config) {
  try {
    await createLocalConfigTable();
    await db.execAsync('DELETE FROM user_configurations;');
    const { role, view_type, theme, font_size } = config;
    await db.runAsync(
      `INSERT INTO user_configurations (role, view_type, theme, font_size)
       VALUES (?, ?, ?, ?);`,
      role,
      view_type,
      theme,
      font_size
    );
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function getConfigLocal() {
  try {
    await createLocalConfigTable();
    const result = await db.getAllAsync('SELECT role, view_type, theme, font_size FROM user_configurations LIMIT 1;');
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    await logErrorToLocal(error);
    return null;
  }
}
