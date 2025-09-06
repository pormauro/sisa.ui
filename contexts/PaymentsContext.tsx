// /contexts/PaymentsContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

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
  /** IDs de archivos adjuntos en formato JSON */
  attached_files?: number[] | string | null;
  category_id: number;
  price: number;
  charge_client: boolean;
  client_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface PaymentsContextValue {
  payments: Payment[];
  loadPayments: () => void;
  addPayment: (payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>) => Promise<Payment | null>;
  updatePayment: (id: number, payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  deletePayment: (id: number) => Promise<boolean>;
}

export const PaymentsContext = createContext<PaymentsContextValue>({
  payments: [],
  loadPayments: () => {},
  addPayment: async () => null,
  updatePayment: async () => false,
  deletePayment: async () => false,
});

export const PaymentsProvider = ({ children }: { children: ReactNode }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const { token } = useContext(AuthContext);

  const loadPayments = async () => {
    try {
      const response = await fetch(`${BASE_URL}/payments`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.payments) {
        setPayments(data.payments);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  const addPayment = async (
    payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Payment | null> => {
    try {
      const payload = {
        ...payment,
        attached_files:
          typeof payment.attached_files === 'string'
            ? payment.attached_files
            : payment.attached_files
            ? JSON.stringify(payment.attached_files)
            : null,
      };
      const response = await fetch(`${BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.payment_id) {
        const newPayment: Payment = { id: parseInt(data.payment_id, 10), ...payload };
        setPayments(prev => [...prev, newPayment]);
        return newPayment;
      }
    } catch (error) {
      console.error('Error adding payment:', error);
    }
    return null;
  };

  const updatePayment = async (
    id: number,
    payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    try {
      const payload = {
        ...payment,
        attached_files:
          typeof payment.attached_files === 'string'
            ? payment.attached_files
            : payment.attached_files
            ? JSON.stringify(payment.attached_files)
            : null,
      };
      const response = await fetch(`${BASE_URL}/payments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.message === 'Payment updated successfully') {
        setPayments(prev => prev.map(p => (p.id === id ? { ...p, ...payload } : p)));
        return true;
      }
    } catch (error) {
      console.error('Error updating payment:', error);
    }
    return false;
  };

  const deletePayment = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/payments/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.message === 'Payment deleted successfully') {
        setPayments(prev => prev.filter(p => p.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
    }
    return false;
  };

  useEffect(() => {
    if (token) {
      loadPayments();
    }
  }, [token]);

  return (
    <PaymentsContext.Provider value={{ payments, loadPayments, addPayment, updatePayment, deletePayment }}>
      {children}
    </PaymentsContext.Provider>
  );
};

