import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalCashBoxesTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS cash_boxes (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT,
        image_file_id INTEGER
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertCashBoxLocal(cashBoxData) {
  const { name, image_file_id } = cashBoxData;
  try {
    const result = await db.runAsync(
      `INSERT INTO cash_boxes (name, image_file_id) VALUES (?, ?);`,
      name,
      image_file_id
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function getAllCashBoxesLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM cash_boxes;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function deleteCashBoxLocal(cashBoxId) {
  try {
    const result = await db.runAsync('DELETE FROM cash_boxes WHERE id = ?;', cashBoxId);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

async function clearLocalCashBoxes() {
  try {
    await db.execAsync('DELETE FROM cash_boxes;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/cash_boxes`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching cash boxes: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverCashBoxes = data.cash_boxes || [];

    if (serverCashBoxes.length > 0) {
      await clearLocalCashBoxes();
      await createLocalCashBoxesTable();
      for (let cb of serverCashBoxes) {
        await insertCashBoxLocal({
          name: cb.name,
          image_file_id: cb.image_file_id,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty cash boxes list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

