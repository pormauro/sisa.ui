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
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';

export interface Payment {
  id: number;
  user_id?: number;
  payment_date: string;
  paid_with_account: number | string | null;
  payment_template_id?: number | null;
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
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<boolean>;
  updatePayment: (id: number, payment: Omit<Payment, 'id'>) => Promise<boolean>;
  deletePayment: (id: number) => Promise<boolean>;
}

export const PaymentsContext = createContext<PaymentsContextValue>({
  payments: [],
  loadPayments: () => {},
  addPayment: async () => false,
  updatePayment: async () => false,
  deletePayment: async () => false,
});

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.warn('No se pudo interpretar la respuesta JSON del endpoint de pagos.', error);
    return null;
  }
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getIdFromLocationHeader = (response: Response): number | null => {
  const location = response.headers.get('Location') ?? response.headers.get('location');
  if (!location) {
    return null;
  }
  const match = /\/(\d+)(?:\D*$|$)/.exec(location);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractPaymentId = (data: unknown): number | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const id = extractPaymentId(item);
      if (id !== null) {
        return id;
      }
    }
    return null;
  }
  const record = data as Record<string, unknown>;
  const directKeys = ['payment_id', 'paymentId', 'id'];
  for (const key of directKeys) {
    if (key in record) {
      const candidate = toNullableNumber(record[key]);
      if (candidate !== null) {
        return candidate;
      }
    }
  }
  const nestedKeys = ['payment', 'data', 'result'];
  for (const nestedKey of nestedKeys) {
    const nested = record[nestedKey];
    const nestedId = extractPaymentId(nested);
    if (nestedId !== null) {
      return nestedId;
    }
  }
  return null;
};

const buildPaymentFromResponse = (
  response: Response,
  data: unknown,
  payload: Omit<Payment, 'id'>
): Payment | null => {
  const resolvedId = extractPaymentId(data) ?? getIdFromLocationHeader(response);
  if (resolvedId === null) {
    return null;
  }
  return { id: resolvedId, ...payload };
};

export const PaymentsProvider = ({ children }: { children: ReactNode }) => {
  const [payments, setPayments] = useCachedState<Payment[]>('payments', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setPayments(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setPayments]);

  const loadPayments = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/payments`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = await response.json();
      if (data.payments) {
        setPayments(sortByNewest(data.payments, getDefaultSortValue));
      }
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar pagos, se solicitará uno nuevo.');
        return;
      }
      console.error('Error loading payments:', error);
    }
  }, [setPayments, token]);

  const addPayment = useCallback(
    async (payment: Omit<Payment, 'id'>): Promise<boolean> => {
      try {
        const payload = {
          ...payment,
          paid_with_account:
            payment.paid_with_account === undefined || payment.paid_with_account === null
              ? null
              : toNullableNumber(payment.paid_with_account) ?? payment.paid_with_account,
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
        await ensureAuthResponse(response);
        const data = await parseJsonSafely(response);
        const newPayment = buildPaymentFromResponse(response, data, payload);
        if (newPayment) {
          setPayments(prev => ensureSortedByNewest([...prev, newPayment], getDefaultSortValue));
        } else if (response.ok) {
          console.warn(
            'El backend confirmó la creación del pago, pero no envió un identificador explícito.'
          );
        }
        if (response.ok) {
          if (!newPayment) {
            await loadPayments();
          }
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al agregar un pago, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error adding payment:', error);
      }
      return false;
    },
    [setPayments, token]
  );

  const updatePayment = useCallback(
    async (id: number, payment: Omit<Payment, 'id'>): Promise<boolean> => {
      try {
        const payload = {
          ...payment,
          paid_with_account:
            payment.paid_with_account === undefined || payment.paid_with_account === null
              ? null
              : toNullableNumber(payment.paid_with_account) ?? payment.paid_with_account,
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
        await ensureAuthResponse(response);
        const data = await parseJsonSafely(response);
        const updatedPayment = buildPaymentFromResponse(response, data, payload) ?? {
          id,
          ...payload,
        };
        if (response.ok) {
          setPayments(prev =>
            ensureSortedByNewest(
              prev.map(p => (p.id === id ? updatedPayment : p)),
              getDefaultSortValue
            )
          );
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al actualizar un pago, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error updating payment:', error);
      }
      return false;
    },
    [setPayments, token]
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
      await ensureAuthResponse(response);
      const data = await response.json();
      if (data.message === 'Payment deleted successfully' || response.ok) {
        setPayments(prev => prev.filter(p => p.id !== id));
        return true;
      }
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al eliminar un pago, se solicitará uno nuevo.');
        return false;
      }
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

