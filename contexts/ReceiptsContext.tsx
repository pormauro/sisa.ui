// /contexts/ReceiptsContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface ReceiptItem {
  category_id: number;
  price: number;
  pay_provider: boolean;
  provider_id?: number | null;
}

export interface Receipt {
  id: number;
  receipt_date: string;
  payer_type: 'client' | 'provider' | 'other';
  payer_client_id?: number | null;
  payer_provider_id?: number | null;
  payer_other?: string | null;
  paid_in_account: string;
  description?: string | null;
  items: ReceiptItem[];
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
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const { token } = useContext(AuthContext);

  const loadReceipts = async () => {
    try {
      const response = await fetch(`${BASE_URL}/receipts`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.receipts) {
        setReceipts(data.receipts);
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
    }
  };

  const addReceipt = async (receipt: Omit<Receipt, 'id'>): Promise<Receipt | null> => {
    try {
      const response = await fetch(`${BASE_URL}/receipts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(receipt),
      });
      const data = await response.json();
      if (data.receipt_id) {
        const newReceipt: Receipt = { id: parseInt(data.receipt_id, 10), ...receipt };
        setReceipts(prev => [...prev, newReceipt]);
        return newReceipt;
      }
    } catch (error) {
      console.error('Error adding receipt:', error);
    }
    return null;
  };

  const updateReceipt = async (id: number, receipt: Omit<Receipt, 'id'>): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/receipts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(receipt),
      });
      const data = await response.json();
      if (data.message === 'Receipt updated successfully') {
        setReceipts(prev => prev.map(r => (r.id === id ? { id, ...receipt } : r)));
        return true;
      }
    } catch (error) {
      console.error('Error updating receipt:', error);
    }
    return false;
  };

  const deleteReceipt = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/receipts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.message === 'Receipt deleted successfully') {
        setReceipts(prev => prev.filter(r => r.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
    }
    return false;
  };

  useEffect(() => {
    if (token) {
      loadReceipts();
    }
  }, [token]);

  return (
    <ReceiptsContext.Provider value={{ receipts, loadReceipts, addReceipt, updateReceipt, deleteReceipt }}>
      {children}
    </ReceiptsContext.Provider>
  );
};

