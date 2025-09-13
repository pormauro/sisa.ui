import { Dispatch, SetStateAction } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import {
  createLocalClientsTable,
  getAllClientsLocal,
  insertClientLocal,
  updateClientLocal,
  deleteClientLocal,
  clearLocalClients,
} from '@/src/database/clientsLocalDB';
import {
  clearQueue as clearQueueDB,
  createSyncQueueTable,
  deleteQueueItem,
  enqueueOperation,
  getAllQueueItems,
  updateQueueItemStatus,
  updateQueueItemBatchId,
} from '@/src/database/syncQueueDB';
import { clearErrorLogs } from '@/src/database/errorLogger';
import { getMaxHistoryId, setMaxHistoryId, clearMaxHistoryId } from '@/src/utils/syncHistory';

export interface Client {
  id: number;
  business_name: string;
  tax_id: string;
  email: string;
  brand_file_id: string | null;
  phone: string;
  address: string;
  tariff_id: number | null;
  version: number;
  created_at?: string;
  updated_at?: string;
  syncStatus?: 'pending' | 'error';
  pendingDelete?: boolean;
}

export interface QueueItem {
  id: number;
  table_name: string;
  op: string;
  record_id: number | null;
  local_temp_id: number | null;
  payload_json: string;
  batch_id?: string | null;
  request_id: string;
  nonce: string;
  status: string;
  last_error?: string | null;
  created_at: number;
}

async function fetchClients(
  token: string,
  setClients: Dispatch<SetStateAction<Client[]>>,
  saveLocal = false
) {
  try {
    const response = await fetch(`${BASE_URL}/clients`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (data.clients) {
      const loaded: Client[] = data.clients.map((c: any) => ({
        ...c,
        tariff_id: c.tariff_id ?? null,
        created_at: c.created_at,
        updated_at: c.updated_at,
        version: c.version ?? 1,
      }));
      setClients(prev => {
        const pending = prev.filter(p => p.syncStatus === 'pending');
        return [...loaded, ...pending];
      });
      if (saveLocal) {
        await clearLocalClients();
        for (const client of loaded) {
          await insertClientLocal(client);
        }
      }
    }
    if (data.history?.max_history_id !== undefined) {
      await setMaxHistoryId(data.history.max_history_id);
    }
  } catch (error) {
    if (__DEV__) {
      console.log('Error loading clients:', error);
    }
    Alert.alert('Error de red', 'No se pudieron cargar los clientes.');
  }
}

export async function loadQueueAction(
  setQueue: Dispatch<SetStateAction<QueueItem[]>>
) {
  const items = await getAllQueueItems();
  setQueue(items);
}

export async function loadClientsAction(
  token: string,
  setClients: Dispatch<SetStateAction<Client[]>>
) {
  const localClients = await getAllClientsLocal();
  setClients(prev => {
    const pending = prev.filter(c => c.syncStatus === 'pending');
    const existingIds = new Set((localClients as Client[]).map(c => c.id));
    const merged = (localClients as Client[]).map(c => {
      const pendingMatch = pending.find(p => p.id === c.id);
      return pendingMatch ?? c;
    });
    const pendingOnly = pending.filter(p => !existingIds.has(p.id));
    return [...merged, ...pendingOnly];
  });

  const batchId = `${Date.now()}-${Math.random()}`;
  try {
    const sinceHistoryId = await getMaxHistoryId();
    if (sinceHistoryId === null) {
      await fetchClients(token, setClients, true);
      return;
    }
    const payload = {
      batch_id: batchId,
      ...(sinceHistoryId !== null ? { since_history_id: sinceHistoryId } : {}),
      ops: [],
    };
    const response = await fetch(`${BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': batchId,
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.history?.max_history_id !== undefined) {
        await setMaxHistoryId(data.history.max_history_id);
      }
      if (Array.isArray(data.history?.changes)) {
        await applyHistoryChanges(data.history.changes, setClients);
      }
      return;
    }
  } catch (error) {
    if (__DEV__) {
      console.log('Incremental sync failed:', error);
    }
  }
  await fetchClients(token, setClients, true);
}

export async function addClientAction(
  token: string,
  clientData: Omit<Client, 'id' | 'version'>,
  setClients: Dispatch<SetStateAction<Client[]>>
): Promise<Client | null> {
  const requestId =
    globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    const batchId = `${Date.now()}-${Math.random()}`;
    try {
      const sinceHistoryId = await getMaxHistoryId();
      const payload = {
        batch_id: batchId,
        ...(sinceHistoryId !== null ? { since_history_id: sinceHistoryId } : {}),
        ops: [
          {
            request_id: requestId,
            entity: 'clients',
            op: 'create',
            local_id: 1,
            data: clientData,
          },
        ],
      };
      const response = await fetch(`${BASE_URL}/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': batchId,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.history?.max_history_id !== undefined) {
          await setMaxHistoryId(data.history.max_history_id);
        }
        if (Array.isArray(data.history?.changes)) {
          await applyHistoryChanges(data.history.changes, setClients);
        }
        const result = data.results?.[0];
        if (data.ok && result?.status === 'done') {
          const created: Client = {
            id: result.remote_id,
            version: result.version ?? 1,
            ...clientData,
          };
          setClients(prev => [...prev, created]);
          await insertClientLocal(created);
          return created;
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error adding client:', error);
      }
    }
  }

  const tempId = Date.now();
  const newClient: Client = {
    id: tempId,
    ...clientData,
    version: 1,
    syncStatus: 'pending',
  };
  setClients(prev => [...prev, newClient]);
  await insertClientLocal({ id: tempId, ...clientData, version: 1 });
  await enqueueOperation('clients', 'create', clientData, null, tempId, requestId);
  return newClient;
}

export async function updateClientAction(
  id: number,
  clientData: Omit<Client, 'id' | 'version'>,
  setClients: Dispatch<SetStateAction<Client[]>>
): Promise<boolean> {
  const version = 1;
  setClients(prev =>
    prev.map(client =>
      client.id === id ? { ...client, ...clientData, syncStatus: 'pending' } : client
    )
  );
  await updateClientLocal(id, { ...clientData, version });
  const requestId =
    globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
  await enqueueOperation(
    'clients',
    'update',
    { ...clientData, if_match_version: version },
    id,
    null,
    requestId
  );
  return true;
}

export async function deleteClientAction(
  id: number,
  setClients: Dispatch<SetStateAction<Client[]>>
): Promise<boolean> {
  setClients(prev =>
    prev.map(client =>
      client.id === id ? { ...client, pendingDelete: true, syncStatus: 'pending' } : client
    )
  );
  await deleteClientLocal(id);
  const requestId =
    globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
  await enqueueOperation('clients', 'delete', {}, id, null, requestId);
  return true;
}

async function applyHistoryChanges(
  changes: any[],
  setClients: Dispatch<SetStateAction<Client[]>>
) {
  if (!Array.isArray(changes)) return;
  for (const change of changes) {
    if (change.entity !== 'clients') continue;
    const version = change.version ?? 1;
    if (change.op === 'create') {
      const newClient: Client = { id: change.remote_id, ...change.data, version };
      setClients(prev => {
        const exists = prev.some(c => c.id === newClient.id);
        return exists
          ? prev.map(c => (c.id === newClient.id ? { ...c, ...newClient } : c))
          : [...prev, newClient];
      });
      await deleteClientLocal(newClient.id);
      await insertClientLocal(newClient);
    } else if (change.op === 'update') {
      const updated = { ...change.data, version };
      setClients(prev => prev.map(c => (c.id === change.remote_id ? { ...c, ...updated } : c)));
      await updateClientLocal(change.remote_id, updated);
    } else if (change.op === 'delete') {
      setClients(prev => prev.filter(c => c.id !== change.remote_id));
      await deleteClientLocal(change.remote_id);
    }
  }
}

export async function processQueueAction(
  token: string,
  setClients: Dispatch<SetStateAction<Client[]>>,
  loadQueue: () => Promise<void>
) {
  const items = await getAllQueueItems();
  for (const item of items) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (item.table_name === 'clients') {
        let batchId = item.batch_id || `${Date.now()}-${Math.random()}`;
        if (!item.batch_id) {
          await updateQueueItemBatchId(item.id, batchId);
        }
        let op: any = {
          request_id: item.request_id,
          entity: 'clients',
          op: item.op,
        };
        const payload = JSON.parse(item.payload_json);
        if (item.op === 'create') {
          op.local_id = item.local_temp_id;
          op.data = payload;
        } else if (item.op === 'update') {
          op.remote_id = item.record_id;
          op.if_match_version = payload.if_match_version;
          const { if_match_version, ...rest } = payload;
          op.data = rest;
        } else if (item.op === 'delete') {
          op.remote_id = item.record_id;
        }
        const sinceHistoryId = await getMaxHistoryId();
        const bodyPayload = {
          batch_id: batchId,
          ...(sinceHistoryId !== null ? { since_history_id: sinceHistoryId } : {}),
          ops: [op],
        };
        const response = await fetch(`${BASE_URL}/sync/batch`, {
          method: 'POST',
          headers: { ...headers, 'Idempotency-Key': batchId },
          body: JSON.stringify(bodyPayload),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.history?.max_history_id !== undefined) {
            await setMaxHistoryId(data.history.max_history_id);
          }
          if (Array.isArray(data.history?.changes)) {
            await applyHistoryChanges(data.history.changes, setClients);
          }
          const result = data.results?.[0];
          if (data.ok && result?.status === 'done') {
            if (item.op === 'create') {
              const newId = result.remote_id;
              const version = result.version ?? 1;
              setClients(prev =>
                prev.map(c =>
                  c.id === item.local_temp_id
                    ? { ...c, id: newId, version, syncStatus: undefined }
                    : c
                )
              );
              await deleteClientLocal(item.local_temp_id);
              await insertClientLocal({ id: newId, ...payload, version });
            } else if (item.op === 'update') {
              const version = result.version ?? payload.if_match_version;
              const { if_match_version, ...rest } = payload;
              setClients(prev =>
                prev.map(c =>
                  c.id === item.record_id
                    ? { ...c, ...rest, version, syncStatus: undefined }
                    : c
                )
              );
              await updateClientLocal(item.record_id, { ...rest, version });
            } else if (item.op === 'delete') {
              setClients(prev => prev.filter(c => c.id !== item.record_id));
            }
            await deleteQueueItem(item.id);
          } else {
            await updateQueueItemStatus(item.id, 'error', 'Invalid response');
            break;
          }
        } else {
          await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
          break;
        }
      }
    } catch (err: any) {
      await updateQueueItemStatus(item.id, 'error', String(err));
      break;
    }
  }
  await loadQueue();
}

export async function clearQueueAction(
  setQueue: Dispatch<SetStateAction<QueueItem[]>>
) {
  await clearQueueDB();
  await loadQueueAction(setQueue);
}

export async function removeQueueItemAction(
  id: number,
  setQueue: Dispatch<SetStateAction<QueueItem[]>>
) {
  await deleteQueueItem(id);
  await loadQueueAction(setQueue);
}

export async function clearDatabasesAction(
  setClients: Dispatch<SetStateAction<Client[]>>,
  setQueue: Dispatch<SetStateAction<QueueItem[]>>
) {
  await clearQueueDB();
  await clearLocalClients();
  await clearErrorLogs();
  setClients([]);
  setQueue([]);
  await clearMaxHistoryId();
}

// Initialize necessary tables
export async function initClientSync() {
  await createSyncQueueTable();
  await createLocalClientsTable();
}
