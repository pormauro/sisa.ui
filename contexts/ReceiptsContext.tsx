// /contexts/ReceiptsContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import NetInfo from '@react-native-community/netinfo';
import {
  clearQueue as clearQueueDB,
  createSyncQueueTable,
  deleteQueueItem,
  enqueueOperation,
  getAllQueueItems,
  updateQueueItemStatus,
} from '@/src/database/syncQueueDB';
import {
  createLocalReceiptsTable,
  getAllReceiptsLocal,
  insertReceiptLocal,
  deleteReceiptLocal,
  clearLocalReceipts,
} from '@/src/database/receiptsLocalDB';
import { mergeOfflineData } from '@/utils/offline';

export interface Receipt {
  id: number;
  user_id?: number;
  receipt_date: string;
  payer_type: 'client' | 'provider' | 'other';
  payer_client_id?: number | null;
  payer_provider_id?: number | null;
  payer_other?: string | null;
  paid_in_account: string;
  description?: string | null;
  attached_files?: number[] | string | null;
  category_id: number;
  price: number;
  pay_provider: boolean;
  provider_id?: number | null;
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

interface ReceiptsContextValue {
  receipts: Receipt[];
  queue: QueueItem[];
  loadReceipts: () => void;
  addReceipt: (receipt: Omit<Receipt, 'id'>) => Promise<Receipt | null>;
  updateReceipt: (id: number, receipt: Omit<Receipt, 'id'>) => Promise<boolean>;
  deleteReceipt: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const ReceiptsContext = createContext<ReceiptsContextValue>({
  receipts: [],
  queue: [],
  loadReceipts: () => {},
  addReceipt: async () => null,
  updateReceipt: async () => false,
  deleteReceipt: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
});

export const ReceiptsProvider = ({ children }: { children: ReactNode }) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalReceiptsTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchReceipts = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localReceipts = await getAllReceiptsLocal();
      setReceipts(prev => mergeOfflineData(localReceipts as Receipt[], prev));
      console.log('Sin conexión: Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchReceipts(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/receipts`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.receipts) {
        const loaded: Receipt[] = data.receipts.map((r: any) => ({
          ...r,
          syncStatus: undefined,
          pendingDelete: undefined,
        }));
        setReceipts(prev => mergeOfflineData(loaded, prev));
        await clearLocalReceipts();
        await createLocalReceiptsTable();
        for (let r of loaded) {
          await insertReceiptLocal(r);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error loading receipts:', error);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchReceipts(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        console.error('Error de red: No se pudieron cargar los recibos.');
      }
    }
  };

  const loadReceipts = async () => {
    await fetchReceipts();
  };

  const addReceipt = async (receiptData: Omit<Receipt, 'id'>): Promise<Receipt | null> => {
    const tempId = Date.now() * -1;
    const newReceipt: Receipt = { id: tempId, ...receiptData, syncStatus: 'pending' };
    setReceipts(prev => [...prev, newReceipt]);
    await insertReceiptLocal(newReceipt);
    await enqueueOperation('receipts', 'create', receiptData, null, tempId);
    await loadQueue();
    processQueue();
    return newReceipt;
  };

  const updateReceipt = async (id: number, receiptData: Omit<Receipt, 'id'>): Promise<boolean> => {
    setReceipts(prev =>
      prev.map(r => (r.id === id ? { ...r, ...receiptData, syncStatus: 'pending' } : r))
    );
    await enqueueOperation('receipts', 'update', receiptData, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const deleteReceipt = async (id: number): Promise<boolean> => {
    setReceipts(prev =>
      prev.map(r => (r.id === id ? { ...r, pendingDelete: true, syncStatus: 'pending' } : r))
    );
    await deleteReceiptLocal(id);
    await enqueueOperation('receipts', 'delete', {}, id, null);
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
        if (item.table_name === 'receipts') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/receipts`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.receipt_id, 10);
              setReceipts(prev =>
                prev.map(r =>
                  r.id === item.local_temp_id ? { ...r, id: newId, syncStatus: undefined } : r
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/receipts/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setReceipts(prev =>
                prev.map(r =>
                  r.id === item.record_id ? { ...r, ...payload, syncStatus: undefined } : r
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/receipts/${item.record_id}`, {
              method: 'DELETE',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              setReceipts(prev => prev.filter(r => r.id !== item.record_id));
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
        await loadReceipts();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadReceipts().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <ReceiptsContext.Provider
      value={{ receipts, queue, loadReceipts, addReceipt, updateReceipt, deleteReceipt, processQueue, clearQueue }}
    >
      {children}
    </ReceiptsContext.Provider>
  );
};

