import * as SQLite from 'expo-sqlite';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createLocalProfilesTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY NOT NULL,
        username TEXT NOT NULL,
        email TEXT,
        activated INTEGER
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function saveProfilesLocal(profiles) {
  try {
    await createLocalProfilesTable();
    await db.execAsync('DELETE FROM profiles;');
    for (const profile of profiles) {
      const { id, username, email, activated } = profile;
      await db.runAsync(
        'INSERT INTO profiles (id, username, email, activated) VALUES (?, ?, ?, ?);',
        id,
        username,
        email,
        activated
      );
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function getProfilesLocal() {
  try {
    await createLocalProfilesTable();
    return await db.getAllAsync('SELECT id, username, email, activated FROM profiles;');
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}
