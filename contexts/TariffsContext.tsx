// contexts/TariffsContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
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
import {
  createLocalTariffsTable,
  getAllTariffsLocal,
  clearLocalTariffs,
  insertTariffLocal,
} from '@/src/database/tariffsLocalDB';
import { mergeOfflineData } from '@/utils/offline';

export interface Tariff {
  id: number;
  name: string;
  amount: number;
  last_update: string;
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

interface TariffsContextType {
  tariffs: Tariff[];
  queue: QueueItem[];
  loadTariffs: () => void;
  addTariff: (tariff: Omit<Tariff, 'id' | 'last_update'>) => Promise<Tariff | null>;
  updateTariff: (id: number, tariff: Omit<Tariff, 'id' | 'last_update'>) => Promise<boolean>;
  deleteTariff: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const TariffsContext = createContext<TariffsContextType>({
  tariffs: [],
  queue: [],
  loadTariffs: () => {},
  addTariff: async () => null,
  updateTariff: async () => false,
  deleteTariff: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
});

export const TariffsProvider = ({ children }: { children: ReactNode }) => {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalTariffsTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchTariffs = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localTariffs = await getAllTariffsLocal();
      setTariffs(prev => mergeOfflineData(localTariffs as Tariff[], prev));
      console.log('Sin conexión: Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchTariffs(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/tariffs`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.tariffs) {
        const parsed = data.tariffs.map((t: any) => ({
          ...t,
          amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount,
        }));
        await clearLocalTariffs();
        for (const tariff of parsed) {
          await insertTariffLocal(tariff);
        }
        setTariffs(parsed);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error loading tariffs:', error);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchTariffs(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        console.error('Error de red: No se pudieron cargar las tarifas.');
      }
    }
  };

  const loadTariffs = async () => {
    await fetchTariffs();
  };

  const addTariff = async (
    tariff: Omit<Tariff, 'id' | 'last_update'>
  ): Promise<Tariff | null> => {
    const tempId = Date.now() * -1;
    const newTariff: Tariff = {
      id: tempId,
      last_update: '',
      ...tariff,
      syncStatus: 'pending',
    };
    setTariffs(prev => [...prev, newTariff]);
    await enqueueOperation('tariffs', 'create', tariff, null, tempId);
    await loadQueue();
    processQueue();
    return newTariff;
  };

  const updateTariff = async (
    id: number,
    tariff: Omit<Tariff, 'id' | 'last_update'>
  ): Promise<boolean> => {
    setTariffs(prev =>
      prev.map(t =>
        t.id === id ? { ...t, ...tariff, syncStatus: 'pending' } : t
      )
    );
    await enqueueOperation('tariffs', 'update', tariff, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const deleteTariff = async (id: number): Promise<boolean> => {
    setTariffs(prev =>
      prev.map(t =>
        t.id === id ? { ...t, pendingDelete: true, syncStatus: 'pending' } : t
      )
    );
    await enqueueOperation('tariffs', 'delete', {}, id, null);
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
        if (item.table_name === 'tariffs') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/tariffs`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.tariff_id, 10);
              setTariffs(prev =>
                prev.map(t =>
                  t.id === item.local_temp_id
                    ? { ...t, id: newId, last_update: data.last_update || '', syncStatus: undefined }
                    : t
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/tariffs/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              const data = await response.json().catch(() => ({}));
              setTariffs(prev =>
                prev.map(t =>
                  t.id === item.record_id
                    ? { ...t, ...payload, last_update: data.last_update || t.last_update, syncStatus: undefined }
                    : t
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/tariffs/${item.record_id}`, {
              method: 'DELETE',
              headers,
            });
            if (response.ok) {
              setTariffs(prev => prev.filter(t => t.id !== item.record_id));
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
        await loadTariffs();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadTariffs().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <TariffsContext.Provider
      value={{
        tariffs,
        queue,
        loadTariffs,
        addTariff,
        updateTariff,
        deleteTariff,
        processQueue,
        clearQueue,
      }}
    >
      {children}
    </TariffsContext.Provider>
  );
};

