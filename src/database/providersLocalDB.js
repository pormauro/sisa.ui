import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

// Se abre la base de datos local
const db = SQLite.openDatabaseSync('mydatabase.db');

/**
 * Crea la tabla "providers" si no existe.
 */
export async function createLocalProvidersTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY NOT NULL,
        business_name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        brand_file_id INTEGER,
        phone TEXT,
        address TEXT
      );
    `);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

/**
 * Inserta un proveedor en la BD local.
 * @param {Object} providerData - Datos del proveedor.
 * @returns {number} - El id insertado.
 */
export async function insertProviderLocal(providerData) {
  const { business_name, tax_id, email, brand_file_id, phone, address } = providerData;
  try {
    const result = await db.runAsync(
      `INSERT INTO providers (business_name, tax_id, email, brand_file_id, phone, address)
       VALUES (?, ?, ?, ?, ?, ?);`,
      business_name,
      tax_id,
      email,
      brand_file_id,
      phone,
      address
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    throw error;
  }
}

/**
 * Retorna todos los proveedores de la BD local.
 * @returns {Array} - Lista de proveedores.
 */
export async function getAllProvidersLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM providers;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

/**
 * Elimina un proveedor local por su id.
 * @param {number} providerId - Id del proveedor a eliminar.
 * @returns {number} - Cantidad de filas afectadas.
 */
export async function deleteProviderLocal(providerId) {
  try {
    const result = await db.runAsync('DELETE FROM providers WHERE id = ?;', providerId);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

/**
 * Borra todos los proveedores de la BD local.
 */
async function clearLocalProviders() {
  try {
    await db.execAsync('DELETE FROM providers;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}

/**
 * Sincroniza la BD local con los datos del servidor.
 * Si el servidor devuelve datos, se actualiza la BD local.
 * En caso de error, se registra en el log interno.
 */
export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/providers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Error fetching providers: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }

    const data = await response.json();
    const serverProviders = data.providers || [];

    if (serverProviders.length > 0) {
      await clearLocalProviders();
      await createLocalProvidersTable();

      for (let p of serverProviders) {
        await insertProviderLocal({
          business_name: p.business_name,
          tax_id: p.tax_id,
          email: p.email,
          brand_file_id: p.brand_file_id,
          phone: p.phone,
          address: p.address,
        });
      }
    } else {
      await logErrorToLocal(new Error('Server returned empty provider list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

