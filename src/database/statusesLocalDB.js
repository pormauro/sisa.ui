import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalStatusesTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS statuses (
        id INTEGER PRIMARY KEY NOT NULL,
        label TEXT,
        value TEXT,
        background_color TEXT,
        order_index INTEGER,
        created_at TEXT,
        updated_at TEXT
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertStatusLocal(statusData) {
  const { label, value, background_color, order_index, created_at, updated_at } = statusData;
  try {
    const result = await db.runAsync(
      `INSERT INTO statuses (label, value, background_color, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      label,
      value,
      background_color,
      order_index,
      created_at,
      updated_at
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function getAllStatusesLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM statuses ORDER BY order_index ASC;');
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

export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/statuses`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching statuses: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverStatuses = data.statuses || [];

    if (serverStatuses.length > 0) {
      await clearLocalStatuses();
      await createLocalStatusesTable();
      for (let s of serverStatuses) {
        await insertStatusLocal({
          label: s.label,
          value: s.value,
          background_color: s.background_color,
          order_index: s.order_index,
          created_at: s.created_at,
          updated_at: s.updated_at,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty statuses list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}
