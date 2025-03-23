import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';
import { logErrorToLocal } from './errorLogger';

// Se abre la base de datos local
const db = SQLite.openDatabaseSync('mydatabase.db');

/**
 * Crea la tabla "clients" si no existe.
 */
export async function createLocalClientsTable() {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS clients (
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
 * Inserta un cliente en la BD local.
 * @param {Object} clientData - Datos del cliente.
 * @returns {number} - El id insertado.
 */
export async function insertClientLocal(clientData) {
  const { business_name, tax_id, email, brand_file_id, phone, address } = clientData;
  try {
    const result = await db.runAsync(
      `INSERT INTO clients (business_name, tax_id, email, brand_file_id, phone, address)
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
 * Retorna todos los clientes de la BD local.
 * @returns {Array} - Lista de clientes.
 */
export async function getAllClientsLocal() {
  try {
    const result = await db.getAllAsync('SELECT * FROM clients;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

/**
 * Elimina un cliente local por su id.
 * @param {number} clientId - Id del cliente a eliminar.
 * @returns {number} - Cantidad de filas afectadas.
 */
export async function deleteClientLocal(clientId) {
  try {
    const result = await db.runAsync('DELETE FROM clients WHERE id = ?;', clientId);
    return result.changes;
  } catch (error) {
    await logErrorToLocal(error);
    return 0;
  }
}

/**
 * Borra todos los clientes de la BD local.
 */
async function clearLocalClients() {
  try {
    await db.execAsync('DELETE FROM clients;');
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
  
    const response = await fetch(`${BASE_URL}/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  
    if (!response.ok) {
      const error = new Error(`Error fetching clients: ${response.status}`);
      await logErrorToLocal(error);
      return;
    }
  
    const data = await response.json();
    const serverClients = data.clients || [];
  
    // Si el servidor devuelve datos, se procede a actualizar la BD local.
    if (serverClients.length > 0) {
      await clearLocalClients();
      // Asegurarse de que la tabla existe
      await createLocalClientsTable();
  
      for (let c of serverClients) {
        await insertClientLocal({
          business_name: c.business_name,
          tax_id: c.tax_id,
          email: c.email,
          brand_file_id: c.brand_file_id,
          phone: c.phone,
          address: c.address,
        });
      }
    } else {
      // Si el servidor no devuelve clientes, se registra el hecho.
      await logErrorToLocal(new Error('Server returned empty client list'));
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}
