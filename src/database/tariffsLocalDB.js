import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

// Open or create local database
const db = SQLite.openDatabaseSync('mydatabase.db');

// Create local tariffs table (no foreign keys)
export async function createLocalTariffsTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tariffs (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        last_update TEXT
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertTariffLocal(tariffData) {
  const { name, amount, last_update } = tariffData;
  try {
    const result = await db.runAsync(
      `INSERT INTO tariffs (name, amount, last_update) VALUES (?, ?, ?);`,
      name,
      amount,
      last_update
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function getAllTariffsLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM tariffs;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function deleteTariffLocal(tariffId) {
  try {
    const result = await db.runAsync('DELETE FROM tariffs WHERE id = ?;', tariffId);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

export async function clearLocalTariffs() {
  try {
    await db.execAsync('DELETE FROM tariffs;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/tariffs`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching tariffs: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverTariffs = data.tariffs || [];

    if (serverTariffs.length > 0) {
      await clearLocalTariffs();
      await createLocalTariffsTable();
      for (let t of serverTariffs) {
        await insertTariffLocal({
          name: t.name,
          amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount,
          last_update: t.last_update,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty tariffs list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

