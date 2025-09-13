// /contexts/ClientsContext.tsx
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import {
  clearQueue as clearQueueDB,
  createSyncQueueTable,
  deleteQueueItem,
  enqueueOperation,
  getAllQueueItems,
  updateQueueItemStatus,
  updateQueueItemBatchId,
} from '@/src/database/syncQueueDB';
import 'react-native-get-random-values';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import {
  createLocalClientsTable,
  getAllClientsLocal,
  insertClientLocal,
  updateClientLocal,
  deleteClientLocal,
  clearLocalClients,
} from '@/src/database/clientsLocalDB';
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
  status: string;
  last_error?: string | null;
}

interface ClientsContextValue {
  clients: Client[];
  queue: QueueItem[];
  loadClients: () => void;
  addClient: (client: Omit<Client, 'id' | 'version'>) => Promise<Client | null>;
  updateClient: (id: number, client: Omit<Client, 'id' | 'version'>) => Promise<boolean>;
  deleteClient: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  removeQueueItem: (id: number) => Promise<void>;
  clearDatabases: () => Promise<void>;
}

export const ClientsContext = createContext<ClientsContextValue>({
  clients: [],
  queue: [],
  loadClients: () => {},
  addClient: async () => null,
  updateClient: async () => false,
  deleteClient: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
  removeQueueItem: async () => {},
  clearDatabases: async () => {},
});

export const ClientsProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalClientsTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchClients = async (attempt = 0, saveLocal = false): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
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
      Alert.alert('Sin conexión', 'Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchClients(attempt + 1, saveLocal), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

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
        setClients(loaded);
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
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchClients(attempt + 1, saveLocal), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        Alert.alert('Error de red', 'No se pudieron cargar los clientes.');
      }
    }
  };

  const loadClients = async () => {
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
        await fetchClients(0, true);
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
          await applyHistoryChanges(data.history.changes);
        }
        return;
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Incremental sync failed:', error);
      }
    }
    await fetchClients(0, true);
  };

  const addClient = async (
    clientData: Omit<Client, 'id' | 'version'>
  ): Promise<Client | null> => {
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
            await applyHistoryChanges(data.history.changes);
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
    await loadQueue();
    processQueue();
    return newClient;
  };

  const updateClient = async (
    id: number,
    clientData: Omit<Client, 'id' | 'version'>
  ): Promise<boolean> => {
    const current = clients.find(c => c.id === id);
    const version = current?.version ?? 1;
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
    await loadQueue();
    processQueue();
    return true;
  };

  const deleteClient = async (id: number): Promise<boolean> => {
    setClients(prev =>
      prev.map(client =>
        client.id === id ? { ...client, pendingDelete: true, syncStatus: 'pending' } : client
      )
    );
    await deleteClientLocal(id);
    const requestId =
      globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
    await enqueueOperation('clients', 'delete', {}, id, null, requestId);
    await loadQueue();
    processQueue();
    return true;
  };

  const clearQueue = async (): Promise<void> => {
    await clearQueueDB();
    await loadQueue();
  };

  const removeQueueItem = async (id: number): Promise<void> => {
    await deleteQueueItem(id);
    await loadQueue();
  };

  const clearDatabases = async (): Promise<void> => {
    await clearQueueDB();
    await clearLocalClients();
    await clearErrorLogs();
    setClients([]);
    setQueue([]);
    await clearMaxHistoryId();
  };

  const applyHistoryChanges = async (changes: any[]) => {
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
        setClients(prev =>
          prev.map(c => (c.id === change.remote_id ? { ...c, ...updated } : c))
        );
        await updateClientLocal(change.remote_id, updated);
      } else if (change.op === 'delete') {
        setClients(prev => prev.filter(c => c.id !== change.remote_id));
        await deleteClientLocal(change.remote_id);
      }
    }
  };

  const processQueue = async () => {
    if (!token) return;
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
              await applyHistoryChanges(data.history.changes);
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
  };

  useEffect(() => {
    if (!token) return;

    const sync = async () => {
      try {
        await processQueue();
      } catch (e) {}
      try {
        await loadClients();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadClients().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <ClientsContext.Provider value={{ clients, queue, loadClients, addClient, updateClient, deleteClient, processQueue, clearQueue, removeQueueItem, clearDatabases }}>
      {children}
    </ClientsContext.Provider>
  );
};
