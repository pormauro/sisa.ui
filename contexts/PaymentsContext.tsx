// /contexts/PaymentsContext.tsx
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
  createLocalPaymentsTable,
  getAllPaymentsLocal,
  insertPaymentLocal,
  deletePaymentLocal,
  clearLocalPayments,
} from '@/src/database/paymentsLocalDB';

export interface Payment {
  id: number;
  user_id?: number;
  payment_date: string;
  paid_with_account: string;
  creditor_type: 'client' | 'provider' | 'other';
  creditor_client_id?: number | null;
  creditor_provider_id?: number | null;
  creditor_other?: string | null;
  description?: string | null;
  attached_files?: number[] | string | null;
  category_id: number;
  price: number;
  charge_client: boolean;
  client_id?: number | null;
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

interface PaymentsContextValue {
  payments: Payment[];
  queue: QueueItem[];
  loadPayments: () => void;
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<Payment | null>;
  updatePayment: (id: number, payment: Omit<Payment, 'id'>) => Promise<boolean>;
  deletePayment: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const PaymentsContext = createContext<PaymentsContextValue>({
  payments: [],
  queue: [],
  loadPayments: () => {},
  addPayment: async () => null,
  updatePayment: async () => false,
  deletePayment: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
});

export const PaymentsProvider = ({ children }: { children: ReactNode }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalPaymentsTable();
    loadQueue();
  }, []);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchPayments = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localPayments = await getAllPaymentsLocal();
      setPayments(localPayments as Payment[]);
      console.log('Sin conexión: Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchPayments(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/payments`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.payments) {
        const loaded: Payment[] = data.payments.map((p: any) => ({
          ...p,
          syncStatus: undefined,
          pendingDelete: undefined,
        }));
        setPayments(loaded);
        await clearLocalPayments();
        await createLocalPaymentsTable();
        for (let p of loaded) {
          await insertPaymentLocal(p);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error loading payments:', error);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchPayments(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        console.error('Error de red: No se pudieron cargar los pagos.');
      }
    }
  };

  const loadPayments = async () => {
    await fetchPayments();
  };

  const addPayment = async (paymentData: Omit<Payment, 'id'>): Promise<Payment | null> => {
    const tempId = Date.now() * -1;
    const newPayment: Payment = { id: tempId, ...paymentData, syncStatus: 'pending' };
    setPayments(prev => [...prev, newPayment]);
    await insertPaymentLocal(newPayment);
    await enqueueOperation('payments', 'create', paymentData, null, tempId);
    await loadQueue();
    processQueue();
    return newPayment;
  };

  const updatePayment = async (id: number, paymentData: Omit<Payment, 'id'>): Promise<boolean> => {
    setPayments(prev =>
      prev.map(p => (p.id === id ? { ...p, ...paymentData, syncStatus: 'pending' } : p))
    );
    await enqueueOperation('payments', 'update', paymentData, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const deletePayment = async (id: number): Promise<boolean> => {
    setPayments(prev =>
      prev.map(p => (p.id === id ? { ...p, pendingDelete: true, syncStatus: 'pending' } : p))
    );
    await deletePaymentLocal(id);
    await enqueueOperation('payments', 'delete', {}, id, null);
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
        if (item.table_name === 'payments') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/payments`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.payment_id, 10);
              setPayments(prev =>
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
            const response = await fetch(`${BASE_URL}/payments/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setPayments(prev =>
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
            const response = await fetch(`${BASE_URL}/payments/${item.record_id}`, {
              method: 'DELETE',
              headers,
            });
            if (response.ok) {
              setPayments(prev => prev.filter(p => p.id !== item.record_id));
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
        await loadPayments();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadPayments().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <PaymentsContext.Provider
      value={{ payments, queue, loadPayments, addPayment, updatePayment, deletePayment, processQueue, clearQueue }}
    >
      {children}
    </PaymentsContext.Provider>
  );
};

