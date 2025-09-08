// contexts/StatusesContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
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
  createLocalStatusesTable,
  getAllStatusesLocal,
} from '@/src/database/statusesLocalDB';

export interface Status {
  id: number;
  label: string;
  value: string;
  background_color: string;
  order_index: number;
  created_at: string;
  updated_at: string;
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

interface StatusesContextType {
  statuses: Status[];
  queue: QueueItem[];
  loadStatuses: () => void;
  addStatus: (status: Omit<Status, 'id' | 'created_at' | 'updated_at'>) => Promise<Status | null>;
  updateStatus: (
    id: number,
    status: Omit<Status, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<boolean>;
  deleteStatus: (id: number) => Promise<boolean>;
  reorderStatuses: (orderedIds: number[]) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const StatusesContext = createContext<StatusesContextType>({
  statuses: [],
  queue: [],
  loadStatuses: () => {},
  addStatus: async () => null,
  updateStatus: async () => false,
  deleteStatus: async () => false,
  reorderStatuses: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
});

export const StatusesProvider = ({ children }: { children: ReactNode }) => {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalStatusesTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchStatuses = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localStatuses = await getAllStatusesLocal();
      setStatuses(localStatuses as Status[]);
      Alert.alert('Sin conexión', 'Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchStatuses(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/statuses`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.statuses) {
        setStatuses(data.statuses);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error loading statuses:', error);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchStatuses(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        Alert.alert('Error de red', 'No se pudieron cargar los estados.');
      }
    }
  };

  const loadStatuses = async () => {
    await fetchStatuses();
  };

  const addStatus = async (
    statusData: Omit<Status, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Status | null> => {
    const tempId = Date.now() * -1;
    const newStatus: Status = {
      id: tempId,
      created_at: '',
      updated_at: '',
      ...statusData,
      syncStatus: 'pending',
    };
    setStatuses(prev => [...prev, newStatus]);
    await enqueueOperation('statuses', 'create', statusData, null, tempId);
    await loadQueue();
    processQueue();
    return newStatus;
  };

  const updateStatus = async (
    id: number,
    statusData: Omit<Status, 'id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    setStatuses(prev =>
      prev.map(s => (s.id === id ? { ...s, ...statusData, syncStatus: 'pending' } : s))
    );
    await enqueueOperation('statuses', 'update', statusData, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const deleteStatus = async (id: number): Promise<boolean> => {
    setStatuses(prev =>
      prev.map(s => (s.id === id ? { ...s, pendingDelete: true, syncStatus: 'pending' } : s))
    );
    await enqueueOperation('statuses', 'delete', {}, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const reorderStatuses = async (orderedIds: number[]): Promise<boolean> => {
    setStatuses(prev => orderedIds.map(id => prev.find(s => s.id === id)!).filter(Boolean));
    await enqueueOperation('statuses', 'reorder', { ordered_ids: orderedIds }, null, null);
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
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
        if (item.table_name === 'statuses') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/statuses`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.status_id, 10);
              setStatuses(prev =>
                prev.map(s =>
                  s.id === item.local_temp_id ? { ...s, id: newId, syncStatus: undefined } : s
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/statuses/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setStatuses(prev =>
                prev.map(s =>
                  s.id === item.record_id
                    ? { ...s, ...payload, syncStatus: undefined }
                    : s
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/statuses/${item.record_id}`, {
              method: 'DELETE',
              headers,
            });
            if (response.ok) {
              setStatuses(prev => prev.filter(s => s.id !== item.record_id));
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'reorder') {
            const response = await fetch(`${BASE_URL}/statuses/reorder`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              await deleteQueueItem(item.id);
              await loadStatuses();
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
        await loadStatuses();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadStatuses().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <StatusesContext.Provider
      value={{
        statuses,
        queue,
        loadStatuses,
        addStatus,
        updateStatus,
        deleteStatus,
        reorderStatuses,
        processQueue,
        clearQueue,
      }}
    >
      {children}
    </StatusesContext.Provider>
  );
};
