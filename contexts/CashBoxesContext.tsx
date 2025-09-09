// C:/Users/Mauri/Documents/GitHub/router/contexts/CashBoxesContext.tsx
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
  createLocalCashBoxesTable,
  getAllCashBoxesLocal,
  clearLocalCashBoxes,
  insertCashBoxLocal,
} from '@/src/database/cashBoxesLocalDB';
import { mergeOfflineData } from '@/utils/offline';

export interface CashBox {
  id: number;
  name: string;
  image_file_id: string | null;
  user_id: number;
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

interface CashBoxesContextType {
  cashBoxes: CashBox[];
  queue: QueueItem[];
  loadCashBoxes: () => void;
  addCashBox: (cashBox: Omit<CashBox, 'id' | 'user_id'>) => Promise<CashBox | null>;
  updateCashBox: (id: number, cashBox: Omit<CashBox, 'id' | 'user_id'>) => Promise<boolean>;
  deleteCashBox: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  listCashBoxHistory: (id: number) => Promise<any[]>;
}

export const CashBoxesContext = createContext<CashBoxesContextType>({
  cashBoxes: [],
  queue: [],
  loadCashBoxes: () => {},
  addCashBox: async () => null,
  updateCashBox: async () => false,
  deleteCashBox: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
  listCashBoxHistory: async () => [],
});

export const CashBoxesProvider = ({ children }: { children: ReactNode }) => {
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalCashBoxesTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchCashBoxes = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localBoxes = await getAllCashBoxesLocal();
      setCashBoxes(prev => mergeOfflineData(localBoxes as CashBox[], prev));
      console.log('Sin conexión: Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchCashBoxes(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/cash_boxes`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.cash_boxes) {
        await clearLocalCashBoxes();
        for (const box of data.cash_boxes) {
          await insertCashBoxLocal(box);
        }
        setCashBoxes(prev => mergeOfflineData(data.cash_boxes, prev));
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error loading cash boxes:', error);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchCashBoxes(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        console.error('Error de red: No se pudieron cargar las cajas.');
      }
    }
  };

  const loadCashBoxes = async () => {
    await fetchCashBoxes();
  };

  const addCashBox = async (
    cashBoxData: Omit<CashBox, 'id' | 'user_id'>
  ): Promise<CashBox | null> => {
    const tempId = Date.now() * -1;
    const newCashBox: CashBox = { id: tempId, user_id: 0, ...cashBoxData, syncStatus: 'pending' };
    setCashBoxes(prev => [...prev, newCashBox]);
    await enqueueOperation('cash_boxes', 'create', cashBoxData, null, tempId);
    await loadQueue();
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      processQueue();
    }
    return newCashBox;
  };

  const updateCashBox = async (
    id: number,
    cashBoxData: Omit<CashBox, 'id' | 'user_id'>
  ): Promise<boolean> => {
    setCashBoxes(prev =>
      prev.map(cb => (cb.id === id ? { ...cb, ...cashBoxData, syncStatus: 'pending' } : cb))
    );
    await enqueueOperation('cash_boxes', 'update', cashBoxData, id, null);
    await loadQueue();
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      processQueue();
    }
    return true;
  };

  const deleteCashBox = async (id: number): Promise<boolean> => {
    setCashBoxes(prev =>
      prev.map(cb => (cb.id === id ? { ...cb, pendingDelete: true, syncStatus: 'pending' } : cb))
    );
    await enqueueOperation('cash_boxes', 'delete', {}, id, null);
    await loadQueue();
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      processQueue();
    }
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
        if (item.table_name === 'cash_boxes') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/cash_boxes`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.cash_box_id, 10);
              setCashBoxes(prev =>
                prev.map(cb =>
                  cb.id === item.local_temp_id ? { ...cb, id: newId, syncStatus: undefined } : cb
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/cash_boxes/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setCashBoxes(prev =>
                prev.map(cb =>
                  cb.id === item.record_id ? { ...cb, ...payload, syncStatus: undefined } : cb
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/cash_boxes/${item.record_id}`, {
              method: 'DELETE',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              setCashBoxes(prev => prev.filter(cb => cb.id !== item.record_id));
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

  const listCashBoxHistory = async (id: number): Promise<any[]> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.warn('Sin conexión: No se puede obtener el historial sin conexión.');
      return [];
    }
    try {
      const response = await fetch(`${BASE_URL}/cash_boxes/${id}/history`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.history) {
        return data.history;
      }
    } catch (error) {
      console.error('Error listing cash box history:', error);
    }
    return [];
  };

  useEffect(() => {
    if (!token) return;

    const sync = async () => {
      try {
        await processQueue();
      } catch (e) {}
      try {
        await loadCashBoxes();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadCashBoxes().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <CashBoxesContext.Provider
      value={{
        cashBoxes,
        queue,
        loadCashBoxes,
        addCashBox,
        updateCashBox,
        deleteCashBox,
        processQueue,
        clearQueue,
        listCashBoxHistory,
      }}
    >
      {children}
    </CashBoxesContext.Provider>
  );
};

