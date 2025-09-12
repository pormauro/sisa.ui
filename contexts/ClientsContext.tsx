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
} from '@/src/database/syncQueueDB';
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

  const fetchClients = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localClients = await getAllClientsLocal();
      setClients(prev => {
        const pending = prev.filter(c => c.syncStatus === 'pending');
        return [...(localClients as Client[]), ...pending];
      });
      Alert.alert('Sin conexión', 'Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchClients(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
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
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error loading clients:', error);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchClients(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        Alert.alert('Error de red', 'No se pudieron cargar los clientes.');
      }
    }
  };

  const loadClients = async () => {
    await fetchClients();
  };

  const addClient = async (
    clientData: Omit<Client, 'id' | 'version'>
  ): Promise<Client | null> => {
    const batchId = `${Date.now()}-${Math.random()}`;
    try {
      const payload = {
        batch_id: batchId,
        ops: [
          {
            request_id: `create-${Date.now()}`,
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
        const result = data.results?.[0];
        if (data.ok && result?.status === 'done') {
          const newClient: Client = {
            id: result.remote_id,
            ...clientData,
            version: result.version ?? 1,
          };
          setClients(prev => [...prev, newClient]);
          await insertClientLocal({ id: newClient.id, ...clientData, version: newClient.version });
          return newClient;
        }
      }
      return null;
    } catch (error) {
      if (__DEV__) {
        console.log('Error adding client:', error);
      }
      return null;
    }
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
    await enqueueOperation('clients', 'update', { ...clientData, if_match_version: version }, id, null);
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
    await enqueueOperation('clients', 'delete', {}, id, null);
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
          const batchId = `${Date.now()}-${Math.random()}`;
          let op: any = {
            request_id: `${item.op}-${item.id}`,
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
          const response = await fetch(`${BASE_URL}/sync/batch`, {
            method: 'POST',
            headers: { ...headers, 'Idempotency-Key': batchId },
            body: JSON.stringify({ batch_id: batchId, ops: [op] }),
          });
          if (response.ok) {
            const data = await response.json();
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
