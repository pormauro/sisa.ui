import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalReceiptsTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY NOT NULL,
        receipt_date TEXT,
        payer_type TEXT,
        payer_client_id INTEGER,
        payer_provider_id INTEGER,
        payer_other TEXT,
        paid_in_account TEXT,
        description TEXT,
        attached_files TEXT,
        category_id INTEGER,
        price REAL,
        pay_provider INTEGER,
        provider_id INTEGER
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertReceiptLocal(receiptData) {
  const {
    receipt_date,
    payer_type,
    payer_client_id,
    payer_provider_id,
    payer_other,
    paid_in_account,
    description,
    attached_files,
    category_id,
    price,
    pay_provider,
    provider_id,
  } = receiptData;
  try {
    const result = await db.runAsync(
      `INSERT INTO receipts (
        receipt_date, payer_type, payer_client_id, payer_provider_id, payer_other,
        paid_in_account, description, attached_files, category_id, price, pay_provider, provider_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      receipt_date,
      payer_type,
      payer_client_id,
      payer_provider_id,
      payer_other,
      paid_in_account,
      description,
      attached_files,
      category_id,
      price,
      pay_provider ? 1 : 0,
      provider_id
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function getAllReceiptsLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM receipts;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function deleteReceiptLocal(id) {
  try {
    const result = await db.runAsync('DELETE FROM receipts WHERE id = ?;', id);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

export async function clearLocalReceipts() {
  try {
    await db.execAsync('DELETE FROM receipts;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/receipts`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching receipts: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverReceipts = data.receipts || [];

    if (serverReceipts.length > 0) {
      await clearLocalReceipts();
      await createLocalReceiptsTable();
      for (let r of serverReceipts) {
        await insertReceiptLocal({
          receipt_date: r.receipt_date,
          payer_type: r.payer_type,
          payer_client_id: r.payer_client_id,
          payer_provider_id: r.payer_provider_id,
          payer_other: r.payer_other,
          paid_in_account: r.paid_in_account,
          description: r.description,
          attached_files: r.attached_files,
          category_id: r.category_id,
          price: r.price,
          pay_provider: r.pay_provider,
          provider_id: r.provider_id,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty receipts list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

