import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalPaymentsTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY NOT NULL,
        payment_date TEXT,
        paid_with_account TEXT,
        creditor_type TEXT,
        creditor_client_id INTEGER,
        creditor_provider_id INTEGER,
        creditor_other TEXT,
        description TEXT,
        attached_files TEXT,
        category_id INTEGER,
        price REAL,
        charge_client INTEGER,
        client_id INTEGER
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertPaymentLocal(paymentData) {
  const {
    payment_date,
    paid_with_account,
    creditor_type,
    creditor_client_id,
    creditor_provider_id,
    creditor_other,
    description,
    attached_files,
    category_id,
    price,
    charge_client,
    client_id,
  } = paymentData;
  try {
    const result = await db.runAsync(
      `INSERT INTO payments (
        payment_date, paid_with_account, creditor_type, creditor_client_id, creditor_provider_id, creditor_other,
        description, attached_files, category_id, price, charge_client, client_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      payment_date,
      paid_with_account,
      creditor_type,
      creditor_client_id,
      creditor_provider_id,
      creditor_other,
      description,
      attached_files,
      category_id,
      price,
      charge_client ? 1 : 0,
      client_id
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function getAllPaymentsLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM payments;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function deletePaymentLocal(id) {
  try {
    const result = await db.runAsync('DELETE FROM payments WHERE id = ?;', id);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

export async function clearLocalPayments() {
  try {
    await db.execAsync('DELETE FROM payments;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/payments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching payments: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverPayments = data.payments || [];

    if (serverPayments.length > 0) {
      await clearLocalPayments();
      await createLocalPaymentsTable();
      for (let p of serverPayments) {
        await insertPaymentLocal({
          payment_date: p.payment_date,
          paid_with_account: p.paid_with_account,
          creditor_type: p.creditor_type,
          creditor_client_id: p.creditor_client_id,
          creditor_provider_id: p.creditor_provider_id,
          creditor_other: p.creditor_other,
          description: p.description,
          attached_files: p.attached_files,
          category_id: p.category_id,
          price: p.price,
          charge_client: p.charge_client,
          client_id: p.client_id,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty payments list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

