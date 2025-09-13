import * as SQLite from 'expo-sqlite';
import { logErrorToLocal } from './errorLogger';

const db = SQLite.openDatabaseSync('mydatabase.db');

export async function createSyncQueueTable() {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        op TEXT NOT NULL,
        record_id INTEGER,
        local_temp_id INTEGER,
        payload_json TEXT,
        batch_id TEXT,
        request_id TEXT,
        nonce TEXT,
        status TEXT NOT NULL,
        last_error TEXT,
        created_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_req
        ON sync_queue(table_name, op, request_id);
    `);

    const columns = await db.getAllAsync('PRAGMA table_info(sync_queue);');
    const hasBatchId = columns.some(c => c.name === 'batch_id');
    if (!hasBatchId) {
      await db.execAsync('ALTER TABLE sync_queue ADD COLUMN batch_id TEXT;');
    }
  } catch (error) {
    await logErrorToLocal(error);
  }
}

function generateNonce(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

export async function enqueueOperation(
  tableName,
  op,
  payload,
  recordId = null,
  localTempId = null,
  requestId
) {
  try {
    const nonce = generateNonce(10);
    const batchId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
    const createdAt = Date.now();
    const result = await db.runAsync(
      `INSERT OR IGNORE INTO sync_queue (table_name, op, record_id, local_temp_id, payload_json, batch_id, request_id, nonce, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?);`,
      tableName,
      op,
      recordId,
      localTempId,
      JSON.stringify(payload),
      batchId,
      requestId,
      nonce,
      createdAt
    );
    return result.lastInsertRowId;
  } catch (error) {
    await logErrorToLocal(error);
    return null;
  }
}

export async function getAllQueueItems() {
  try {
    const result = await db.getAllAsync('SELECT * FROM sync_queue ORDER BY id ASC;');
    return result;
  } catch (error) {
    await logErrorToLocal(error);
    return [];
  }
}

export async function updateQueueItemStatus(id, status, lastError = null) {
  try {
    await db.runAsync('UPDATE sync_queue SET status = ?, last_error = ? WHERE id = ?;', status, lastError, id);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function updateQueueItemBatchId(id, batchId) {
  try {
    await db.runAsync('UPDATE sync_queue SET batch_id = ? WHERE id = ?;', batchId, id);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function deleteQueueItem(id) {
  try {
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?;', id);
  } catch (error) {
    await logErrorToLocal(error);
  }
}

export async function clearQueue() {
  try {
    await db.runAsync('DELETE FROM sync_queue;');
  } catch (error) {
    await logErrorToLocal(error);
  }
}
