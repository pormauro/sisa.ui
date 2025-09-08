// /contexts/ProvidersContext.tsx
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
  createLocalProvidersTable,
  getAllProvidersLocal,
} from '@/src/database/providersLocalDB';

export interface Provider {
  id: number;
  business_name: string;
  tax_id?: string;
  email?: string;
  brand_file_id?: string | null;
  phone?: string;
  address?: string;
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

interface ProvidersContextValue {
  providers: Provider[];
  queue: QueueItem[];
  loadProviders: () => void;
  addProvider: (provider: Omit<Provider, 'id'>) => Promise<Provider | null>;
  updateProvider: (id: number, provider: Omit<Provider, 'id'>) => Promise<boolean>;
  deleteProvider: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const ProvidersContext = createContext<ProvidersContextValue>({
  providers: [],
  queue: [],
  loadProviders: () => {},
  addProvider: async () => null,
  updateProvider: async () => false,
  deleteProvider: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
});

export const ProvidersProvider = ({ children }: { children: ReactNode }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalProvidersTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchProviders = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localProviders = await getAllProvidersLocal();
      setProviders(localProviders as Provider[]);
      Alert.alert('Sin conexión', 'Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchProviders(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/providers`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.providers) {
        const loaded: Provider[] = data.providers.map((p: any) => ({
          ...p,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }));
        setProviders(loaded);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error loading providers:', error);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchProviders(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        Alert.alert('Error de red', 'No se pudieron cargar los proveedores.');
      }
    }
  };

  const loadProviders = async () => {
    await fetchProviders();
  };

  const addProvider = async (providerData: Omit<Provider, 'id'>): Promise<Provider | null> => {
    const tempId = Date.now() * -1;
    const newProvider: Provider = { id: tempId, ...providerData, syncStatus: 'pending' };
    setProviders(prev => [...prev, newProvider]);
    await enqueueOperation('providers', 'create', providerData, null, tempId);
    await loadQueue();
    processQueue();
    return newProvider;
  };

  const updateProvider = async (id: number, providerData: Omit<Provider, 'id'>): Promise<boolean> => {
    setProviders(prev =>
      prev.map(provider =>
        provider.id === id ? { ...provider, ...providerData, syncStatus: 'pending' } : provider
      )
    );
    await enqueueOperation('providers', 'update', providerData, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const deleteProvider = async (id: number): Promise<boolean> => {
    setProviders(prev =>
      prev.map(provider =>
        provider.id === id ? { ...provider, pendingDelete: true, syncStatus: 'pending' } : provider
      )
    );
    await enqueueOperation('providers', 'delete', {}, id, null);
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
        if (item.table_name === 'providers') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/providers`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.provider_id, 10);
              setProviders(prev =>
                prev.map(p =>
                  p.id === item.local_temp_id ? { ...p, id: newId, syncStatus: undefined } : p
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/providers/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setProviders(prev =>
                prev.map(p =>
                  p.id === item.record_id ? { ...p, ...payload, syncStatus: undefined } : p
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/providers/${item.record_id}`, {
              method: 'DELETE',
              headers,
            });
            if (response.ok) {
              setProviders(prev => prev.filter(p => p.id !== item.record_id));
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
    if (!token) return;

    const sync = async () => {
      try {
        await processQueue();
      } catch (e) {}
      try {
        await loadProviders();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadProviders().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <ProvidersContext.Provider value={{ providers, queue, loadProviders, addProvider, updateProvider, deleteProvider, processQueue, clearQueue }}>
      {children}
    </ProvidersContext.Provider>
  );
};

