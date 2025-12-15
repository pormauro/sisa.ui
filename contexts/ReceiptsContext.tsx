// /contexts/ReceiptsContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

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
  /** IDs de archivos adjuntos en formato JSON */
  attached_files?: number[] | string | null;
  category_id: number;
  price: number;
  pay_provider: boolean;
  provider_id?: number | null;
}

interface ReceiptsContextValue {
  receipts: Receipt[];
  loadReceipts: () => void;
  addReceipt: (receipt: Omit<Receipt, 'id'>) => Promise<Receipt | null>;
  updateReceipt: (id: number, receipt: Omit<Receipt, 'id'>) => Promise<boolean>;
  deleteReceipt: (id: number) => Promise<boolean>;
}

export const ReceiptsContext = createContext<ReceiptsContextValue>({
  receipts: [],
  loadReceipts: () => {},
  addReceipt: async () => null,
  updateReceipt: async () => false,
  deleteReceipt: async () => false,
});

export const ReceiptsProvider = ({ children }: { children: ReactNode }) => {
  const [receipts, setReceipts] = useCachedState<Receipt[]>('receipts', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setReceipts(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setReceipts]);

  const loadReceipts = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/receipts`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = await response.json();
      if (data.receipts) {
        setReceipts(sortByNewest(data.receipts, getDefaultSortValue));
      }
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar recibos, se solicitará uno nuevo.');
        return;
      }
      console.error('Error loading receipts:', error);
    }
  }, [setReceipts, token]);

  const addReceipt = useCallback(
    async (receipt: Omit<Receipt, 'id'>): Promise<Receipt | null> => {
      try {
        const payload = {
          ...receipt,
          attached_files:
            typeof receipt.attached_files === 'string'
              ? receipt.attached_files
              : receipt.attached_files
              ? JSON.stringify(receipt.attached_files)
              : null,
        };
        const response = await fetch(`${BASE_URL}/receipts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        if (data.receipt_id) {
          const newReceipt: Receipt = { id: parseInt(data.receipt_id, 10), ...payload };
          setReceipts(prev => ensureSortedByNewest([...prev, newReceipt], getDefaultSortValue));
          await loadReceipts();
          return newReceipt;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al agregar un recibo, se solicitará uno nuevo.');
          return null;
        }
        console.error('Error adding receipt:', error);
      }
      return null;
    },
    [loadReceipts, setReceipts, token]
  );

  const updateReceipt = useCallback(
    async (id: number, receipt: Omit<Receipt, 'id'>): Promise<boolean> => {
      try {
        const payload = {
          ...receipt,
          attached_files:
            typeof receipt.attached_files === 'string'
              ? receipt.attached_files
              : receipt.attached_files
              ? JSON.stringify(receipt.attached_files)
              : null,
        };
        const response = await fetch(`${BASE_URL}/receipts/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        if (data.message === 'Receipt updated successfully') {
          setReceipts(prev =>
            ensureSortedByNewest(
              prev.map(r => (r.id === id ? { id, ...payload } : r)),
              getDefaultSortValue
            )
          );
          await loadReceipts();
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al actualizar un recibo, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error updating receipt:', error);
      }
      return false;
    },
    [loadReceipts, setReceipts, token]
  );

  const deleteReceipt = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/receipts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = await response.json();
      if (data.message === 'Receipt deleted successfully') {
        setReceipts(prev => prev.filter(r => r.id !== id));
        return true;
      }
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al eliminar un recibo, se solicitará uno nuevo.');
        return false;
      }
      console.error('Error deleting receipt:', error);
    }
    return false;
  };

  return (
    <ReceiptsContext.Provider value={{ receipts, loadReceipts, addReceipt, updateReceipt, deleteReceipt }}>
      {children}
    </ReceiptsContext.Provider>
  );
};

