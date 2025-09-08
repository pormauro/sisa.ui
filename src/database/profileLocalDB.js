import * as SQLite from 'expo-sqlite';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalProfileTable() {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY NOT NULL,
        full_name TEXT,
        phone TEXT,
        address TEXT,
        cuit TEXT,
        profile_file_id INTEGER
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function saveProfileLocal(profile) {
  const { id, full_name, phone, address, cuit, profile_file_id } = profile;
  try {
    await createLocalProfileTable();
    await db.execAsync('DELETE FROM profiles;');
    await db.runAsync(
      `INSERT INTO profiles (id, full_name, phone, address, cuit, profile_file_id)
       VALUES (?, ?, ?, ?, ?, ?);`,
      id,
      full_name,
      phone,
      address,
      cuit,
      profile_file_id
    );
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function getProfileLocal() {
  try {
    await createLocalProfileTable();
    const result = await db.getAllAsync('SELECT * FROM profiles LIMIT 1;');
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    await logErrorToLocal(error);
    return null;
  }
}
