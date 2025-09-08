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

export interface Client {
  id: number;
  business_name: string;
  tax_id: string;
  email: string;
  brand_file_id: string | null;
  phone: string;
  address: string;
  tariff_id: number | null;
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
  addClient: (client: Omit<Client, 'id'>) => Promise<Client | null>;
  updateClient: (id: number, client: Omit<Client, 'id'>) => Promise<boolean>;
  deleteClient: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
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
    loadQueue();
  }, []);

  const loadClients = async () => {
    
    try {
      const response = await fetch(`${BASE_URL}/clients`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.clients) {
        const loaded: Client[] = data.clients.map((c: any) => ({
          ...c,
          tariff_id: c.tariff_id ?? null,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
        setClients(loaded);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const addClient = async (clientData: Omit<Client, 'id'>): Promise<Client | null> => {
    const tempId = Date.now() * -1;
    const newClient: Client = { id: tempId, ...clientData, syncStatus: 'pending' };
    setClients(prev => [...prev, newClient]);
    await enqueueOperation('clients', 'create', clientData, null, tempId);
    await loadQueue();
    processQueue();
    return newClient;
  };

  const updateClient = async (id: number, clientData: Omit<Client, 'id'>): Promise<boolean> => {
    setClients(prev =>
      prev.map(client =>
        client.id === id ? { ...client, ...clientData, syncStatus: 'pending' } : client
      )
    );
    await enqueueOperation('clients', 'update', clientData, id, null);
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
    await enqueueOperation('clients', 'delete', {}, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const clearQueue = async (): Promise<void> => {
    await clearQueueDB();
    await loadQueue();
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
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/clients`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.client_id, 10);
              setClients(prev =>
                prev.map(c =>
                  c.id === item.local_temp_id ? { ...c, id: newId, syncStatus: undefined } : c
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/clients/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setClients(prev =>
                prev.map(c =>
                  c.id === item.record_id ? { ...c, ...payload, syncStatus: undefined } : c
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/clients/${item.record_id}`, {
              method: 'DELETE',
              headers,
            });
            if (response.ok) {
              setClients(prev => prev.filter(c => c.id !== item.record_id));
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
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
    if (token) {
      loadClients();
      processQueue();
    }
  }, [token]);

  return (
    <ClientsContext.Provider value={{ clients, queue, loadClients, addClient, updateClient, deleteClient, processQueue, clearQueue }}>
      {children}
    </ClientsContext.Provider>
  );
};
