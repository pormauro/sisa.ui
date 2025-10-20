// /contexts/InvoicesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export type InvoiceStatus = 'pending' | 'paid' | 'cancelled' | string;

export interface Invoice {
  id: number;
  number?: string | null;
  invoice_number?: string | null;
  code?: string | null;
  client_id?: number | null;
  clientId?: number | null;
  client_name?: string | null;
  provider_id?: number | null;
  providerId?: number | null;
  provider_name?: string | null;
  description?: string | null;
  notes?: string | null;
  total?: number | null;
  amount?: number | null;
  total_amount?: number | null;
  subtotal?: number | null;
  status?: InvoiceStatus | null;
  state?: InvoiceStatus | null;
  issued_at?: string | null;
  issue_date?: string | null;
  date?: string | null;
  due_at?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

interface InvoicesContextValue {
  invoices: Invoice[];
  loadInvoices: () => Promise<void>;
  updateInvoiceStatus: (id: number, status: InvoiceStatus) => Promise<boolean>;
  refreshInvoice: (id: number) => Promise<Invoice | null>;
}

const noop = async () => {};

export const InvoicesContext = createContext<InvoicesContextValue>({
  invoices: [],
  loadInvoices: noop,
  updateInvoiceStatus: async () => false,
  refreshInvoice: async () => null,
});

const extractInvoiceList = (payload: unknown): unknown[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === 'object') {
    const candidates = ['invoices', 'data', 'items', 'results'];
    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
};

const toInvoice = (raw: unknown): Invoice | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const idRaw = record['id'] ?? record['invoice_id'] ?? record['invoiceId'];
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
  if (!Number.isFinite(id)) {
    return null;
  }

  const normalised: Invoice = {
    id,
    ...record,
  };

  const possibleTotals = [
    record['total'],
    record['total_amount'],
    record['amount'],
    record['subtotal'],
    record['grand_total'],
  ];
  for (const value of possibleTotals) {
    if (value === undefined || value === null) {
      continue;
    }
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(numeric)) {
      normalised.total = numeric;
      break;
    }
  }

  const possibleStatuses = [record['status'], record['state'], record['invoice_status']];
  for (const value of possibleStatuses) {
    if (typeof value === 'string' && value.trim()) {
      normalised.status = value as InvoiceStatus;
      break;
    }
  }

  if (!normalised.status) {
    normalised.status = 'pending';
  }

  return normalised;
};

export const InvoicesProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [invoices, setInvoices] = useCachedState<Invoice[]>('invoices', []);
  const invoicesRef = useRef(invoices);

  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  useEffect(() => {
    setInvoices(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setInvoices]);

  const loadInvoices = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/invoices`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al cargar facturas`);
      }

      const payload = await response.json().catch(() => ({}));
      const list = extractInvoiceList(payload)
        .map(toInvoice)
        .filter((invoice): invoice is Invoice => invoice !== null);

      setInvoices(sortByNewest(list, getDefaultSortValue));
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }, [setInvoices, token]);

  const refreshInvoice = useCallback(
    async (id: number): Promise<Invoice | null> => {
      if (!token) {
        return null;
      }

      try {
        const response = await fetch(`${BASE_URL}/invoices/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} al cargar la factura ${id}`);
        }

        const data = await response.json().catch(() => ({}));
        const list = extractInvoiceList(data);
        if (list.length > 0) {
          const parsed = toInvoice(list[0]);
          if (parsed) {
            setInvoices(prev =>
              ensureSortedByNewest(
                prev.map(item => (item.id === parsed.id ? { ...item, ...parsed } : item)),
                getDefaultSortValue
              )
            );
            return parsed;
          }
        }

        const parsed = toInvoice(data);
        if (parsed) {
          setInvoices(prev =>
            ensureSortedByNewest(
              prev.map(item => (item.id === parsed.id ? { ...item, ...parsed } : item)),
              getDefaultSortValue
            )
          );
          return parsed;
        }
      } catch (error) {
        console.error('Error refreshing invoice:', error);
      }

      return null;
    },
    [setInvoices, token]
  );

  const updateInvoiceStatus = useCallback(
    async (id: number, status: InvoiceStatus): Promise<boolean> => {
      if (!token) {
        return false;
      }

      const request = async (method: 'PATCH' | 'PUT', body: Record<string, unknown>) => {
        try {
          const response = await fetch(`${BASE_URL}/invoices/${id}`, {
            method,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status} ${method} /invoices/${id} ${text}`);
          }

          if (response.status === 204) {
            return true;
          }

          const data = await response.json().catch(() => ({}));
          if (typeof data === 'object' && data) {
            if ('error' in data && data.error) {
              const detail = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
              throw new Error(detail);
            }

            if ('message' in data) {
              const message = String((data as Record<string, unknown>).message ?? '').toLowerCase();
              if (message.includes('error')) {
                throw new Error(String((data as Record<string, unknown>).message));
              }
            }
          }

          return true;
        } catch (error) {
          console.error(`Error updating invoice status using ${method}:`, error);
          return false;
        }
      };

      const patchSuccess = await request('PATCH', { status });
      if (patchSuccess) {
        setInvoices(prev =>
          ensureSortedByNewest(
            prev.map(item => (item.id === id ? { ...item, status } : item)),
            getDefaultSortValue
          )
        );
        return true;
      }

      const fallbackInvoice = invoicesRef.current.find(item => item.id === id);
      if (!fallbackInvoice) {
        return false;
      }

      const putSuccess = await request('PUT', { ...fallbackInvoice, status });
      if (putSuccess) {
        setInvoices(prev =>
          ensureSortedByNewest(
            prev.map(item => (item.id === id ? { ...item, status } : item)),
            getDefaultSortValue
          )
        );
        return true;
      }

      Alert.alert(
        'No se pudo actualizar la factura',
        'Intenta nuevamente más tarde o revisa tu conexión.'
      );
      return false;
    },
    [setInvoices, token]
  );

  useEffect(() => {
    if (token) {
      void loadInvoices();
    }
  }, [loadInvoices, token]);

  const contextValue = useMemo(
    () => ({ invoices, loadInvoices, updateInvoiceStatus, refreshInvoice }),
    [invoices, loadInvoices, refreshInvoice, updateInvoiceStatus]
  );

  return <InvoicesContext.Provider value={contextValue}>{children}</InvoicesContext.Provider>;
};
