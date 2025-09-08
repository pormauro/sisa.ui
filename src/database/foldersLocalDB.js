import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

// Open or create local database
const db = SQLite.openDatabaseSync('mydatabase.db');

// Create local folders table (no foreign keys)
export async function createLocalFoldersTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT,
        parent_id INTEGER,
        folder_image_file_id TEXT,
        client_id INTEGER,
        user_id INTEGER
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertFolderLocal(folderData) {
  const { name, parent_id, folder_image_file_id, client_id, user_id } = folderData;
  try {
    const result = await db.runAsync(
      `INSERT INTO folders (name, parent_id, folder_image_file_id, client_id, user_id)
       VALUES (?, ?, ?, ?, ?);`,
      name,
      parent_id,
      folder_image_file_id,
      client_id,
      user_id
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function getAllFoldersLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM folders;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function deleteFolderLocal(folderId) {
  try {
    const result = await db.runAsync('DELETE FROM folders WHERE id = ?;', folderId);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

export async function clearLocalFolders() {
  try {
    await db.execAsync('DELETE FROM folders;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/folders`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching folders: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverFolders = data.folders || [];

    if (serverFolders.length > 0) {
      await clearLocalFolders();
      await createLocalFoldersTable();
      for (let f of serverFolders) {
        await insertFolderLocal({
          name: f.name,
          parent_id: f.parent_id,
          folder_image_file_id: f.folder_image_file_id,
          client_id: f.client_id,
          user_id: f.user_id,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty folders list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

