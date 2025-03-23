// src/database/errorLogger.js
import * as SQLite from 'expo-sqlite';

// Se abre (o crea) la base de datos local
const db = SQLite.openDatabaseSync('mydatabase.db');

/**
 * Crea la tabla de logs de errores (error_logs) si no existe.
 */
export async function createErrorLogTable() {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        error_message TEXT,
        error_stack TEXT,
        timestamp TEXT
      );
    `);
  } catch (error) {
    console.error('Error creating error_logs table:', error);
  }
}

/**
 * Registra un error en la tabla error_logs.
 * @param {Error} error - Objeto de error a registrar.
 */
export async function logErrorToLocal(error) {
  try {
    await createErrorLogTable();
    const timestamp = new Date().toISOString();
    const errorMessage = error.message || 'Unknown error';
    const errorStack = error.stack || '';
    await db.runAsync(
      `INSERT INTO error_logs (error_message, error_stack, timestamp)
       VALUES (?, ?, ?);`,
      errorMessage,
      errorStack,
      timestamp
    );
  } catch (loggingError) {
    console.error('Error logging error to local DB:', loggingError);
  }
}

/**
 * Obtiene todos los registros de error_logs ordenados por id descendente.
 */
export async function getErrorLogs() {
  try {
    await createErrorLogTable();
    const result = await db.getAllAsync("SELECT * FROM error_logs ORDER BY id DESC;");
    return result;
  } catch (error) {
    console.error("Error fetching error logs:", error);
    return [];
  }
}

/**
 * Elimina todos los registros de error_logs.
 */
export async function clearErrorLogs() {
  try {
    await createErrorLogTable();
    await db.execAsync("DELETE FROM error_logs;");
  } catch (error) {
    console.error("Error clearing error logs:", error);
  }
}
