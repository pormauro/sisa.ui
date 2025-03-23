// sisa/app/database/clientsLocalDB.js

import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/index';

// Abre (o crea) la base de datos local "mydatabase.db"
const db = SQLite.openDatabase('mydatabase.db');

/**
 * Crea la tabla local "clients" si no existe.
 * Ajusta columnas según tus necesidades.
 */
export function createLocalClientsTable() {
  db.transaction((tx) => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY NOT NULL,
        business_name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        brand_file_id INTEGER,
        phone TEXT,
        address TEXT
        -- Podrías añadir user_id, is_deleted, etc.
      );`
    );
  });
}

/**
 * Retorna la lista de todos los clientes en BD local.
 */
export function getAllClientsLocal() {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM clients',
        [],
        (_, { rows }) => resolve(rows._array),
        (_, error) => reject(error)
      );
    });
  });
}

/**
 * Inserta un cliente en la BD local.
 * Retorna el ID insertado (autoincrement).
 */
export function insertClientLocal(clientData) {
  const {
    business_name,
    tax_id,
    email,
    brand_file_id,
    phone,
    address,
  } = clientData;

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `INSERT INTO clients (business_name, tax_id, email, brand_file_id, phone, address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [business_name, tax_id, email, brand_file_id, phone, address],
        (_, result) => {
          // result.insertId es el ID autoincrement
          resolve(result.insertId);
        },
        (_, error) => reject(error)
      );
    });
  });
}

/**
 * Actualiza un cliente local por su id.
 */
export function updateClientLocal(clientId, clientData) {
  const {
    business_name,
    tax_id,
    email,
    brand_file_id,
    phone,
    address,
  } = clientData;

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `UPDATE clients
         SET business_name = ?, tax_id = ?, email = ?, brand_file_id = ?, phone = ?, address = ?
         WHERE id = ?`,
        [business_name, tax_id, email, brand_file_id, phone, address, clientId],
        (_, result) => resolve(result.rowsAffected),
        (_, error) => reject(error)
      );
    });
  });
}

/**
 * Elimina un cliente local por su id.
 */
export function deleteClientLocal(clientId) {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'DELETE FROM clients WHERE id = ?',
        [clientId],
        (_, result) => resolve(result.rowsAffected),
        (_, error) => reject(error)
      );
    });
  });
}

/**
 * Limpia por completo la tabla local.
 */
function clearLocalClients() {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'DELETE FROM clients',
        [],
        () => resolve(true),
        (_, err) => reject(err)
      );
    });
  });
}

/* =======================================================
   FUNCIONES DE SINCRONIZACIÓN CON EL SERVIDOR
   Aquí reusamos la lógica que antes tenías en tus fetch
   (GET /clients, POST/clients, etc.)
========================================================= */

/**
 * "Pull": Descarga la lista del servidor y pisamos la BD local.
 */
export async function syncFromServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${BASE_URL}/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.log('syncFromServer: Error al obtener /clients', response.status);
      return;
    }
    const data = await response.json();
    const serverClients = data.clients || [];

    // Borramos lo local y volvemos a insertar todo
    await clearLocalClients();
    createLocalClientsTable();

    for (let c of serverClients) {
      // Reusa la misma función local
      await insertClientLocal({
        business_name: c.business_name,
        tax_id: c.tax_id,
        email: c.email,
        brand_file_id: c.brand_file_id,
        phone: c.phone,
        address: c.address,
        // id se autogenera local; si deseas forzar usar el id del server,
        // podrías ajustarlo, pero puede causar conflicto si es PK autoinc.
      });
    }

  } catch (error) {
    console.error('syncFromServer: ', error);
  }
}

/**
 * "Push": Subir los cambios locales al servidor.
 * (La forma ideal es con un campo "sync_status" o "updated_at" para no subir todo).
 * Aquí es un ejemplo simple que llama PUT /clients/{id} si ya existe en el server,
 * o POST /clients si es nuevo, etc.
 */
export async function syncToServer() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    // Obtenemos toda la tabla local
    const localClients = await getAllClientsLocal();

    // Ejemplo super-simplificado:
    // Si en el servidor no existe un "id", se hace POST
    // Caso contrario, se hace PUT. (Habría que verificar).
    for (let client of localClients) {
      // Supongamos que "id" local coincide con "id" server,
      // y si no existe, se hace POST. 
      // NOTA: Esto puede fallar en escenarios reales, lo ideal es un "server_id".
      const checkResp = await fetch(`${BASE_URL}/clients/${client.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (checkResp.ok) {
        // => existe => PUT
        await fetch(`${BASE_URL}/clients/${client.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(client),
        });
      } else {
        // => no existe => POST
        // (excluyendo id local, pues el server genera su propio id)
        const payload = { ...client };
        delete payload.id;

        await fetch(`${BASE_URL}/clients`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }
    }
  } catch (error) {
    console.error('syncToServer:', error);
  }
}
