import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

// Open or create local database
const db = SQLite.openDatabaseSync('mydatabase.db');

// Create local categories table (no foreign keys)
export async function createLocalCategoriesTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY NOT NULL,
        parent_id INTEGER,
        name TEXT NOT NULL,
        type TEXT NOT NULL
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function insertCategoryLocal(categoryData) {
  const { parent_id, name, type } = categoryData;
  try {
    const result = await db.runAsync(
      `INSERT INTO categories (parent_id, name, type) VALUES (?, ?, ?);`,
      parent_id,
      name,
      type
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

export async function getAllCategoriesLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM categories;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function deleteCategoryLocal(categoryId) {
  try {
    const result = await db.runAsync('DELETE FROM categories WHERE id = ?;', categoryId);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

export async function clearLocalCategories() {
  try {
    await db.execAsync('DELETE FROM categories;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching categories: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverCategories = data.categories || [];

    if (serverCategories.length > 0) {
      await clearLocalCategories();
      await createLocalCategoriesTable();
      for (let c of serverCategories) {
        await insertCategoryLocal({
          parent_id: c.parent_id ?? null,
          name: c.name,
          type: c.type,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty category list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

