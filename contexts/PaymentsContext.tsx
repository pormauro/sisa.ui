// /contexts/PaymentsContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

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
}

interface PaymentsContextValue {
  payments: Payment[];
  loadPayments: () => void;
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<Payment | null>;
  updatePayment: (id: number, payment: Omit<Payment, 'id'>) => Promise<boolean>;
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
  const [payments, setPayments] = useCachedState<Payment[]>('payments', []);
  const { token } = useContext(AuthContext);

  const loadPayments = useCallback(async () => {
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
  }, [setPayments, token]);

  const addPayment = useCallback(
    async (payment: Omit<Payment, 'id'>): Promise<Payment | null> => {
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
          await loadPayments();
          return newPayment;
        }
      } catch (error) {
        console.error('Error adding payment:', error);
      }
      return null;
    },
    [loadPayments, setPayments, token]
  );

  const updatePayment = useCallback(
    async (id: number, payment: Omit<Payment, 'id'>): Promise<boolean> => {
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
          setPayments(prev => prev.map(p => (p.id === id ? { id, ...payload } : p)));
          await loadPayments();
          return true;
        }
      } catch (error) {
        console.error('Error updating payment:', error);
      }
      return false;
    },
    [loadPayments, setPayments, token]
  );

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
      void loadPayments();
    }
  }, [loadPayments, token]);

  return (
    <PaymentsContext.Provider value={{ payments, loadPayments, addPayment, updatePayment, deletePayment }}>
      {children}
    </PaymentsContext.Provider>
  );
};

