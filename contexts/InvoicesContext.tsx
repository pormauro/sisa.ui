// /contexts/InvoicesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export type InvoiceStatus = 'pending' | 'paid' | 'cancelled' | string;

export interface AfipEvent {
  id: string;
  invoice_id?: number | null;
  invoiceId?: number | null;
  point_of_sale?: string | number | null;
  pointOfSale?: string | number | null;
  event?: string | null;
  status?: string | null;
  level?: string | null;
  message?: string | null;
  detail?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

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
  cae?: string | null;
  cae_due_date?: string | null;
  afip_response_payload?: unknown;
  afip_events?: AfipEvent[];
  [key: string]: unknown;
}

interface AfipInvoiceMetadata {
  cae: string | null;
  cae_due_date: string | null;
  afip_response_payload: unknown;
  afip_events: AfipEvent[];
}

export interface CaeExpiryAlert {
  invoiceId: number;
  cae?: string | null;
  caeDueDate: string;
  daysUntilExpiration: number;
  invoiceNumber: string;
}

interface InvoicesContextValue {
  invoices: Invoice[];
  loadInvoices: () => Promise<void>;
  updateInvoiceStatus: (id: number, status: InvoiceStatus) => Promise<boolean>;
  refreshInvoice: (id: number) => Promise<Invoice | null>;
  requestInvoiceReprint: (id: number) => Promise<boolean>;
  caeAlerts: CaeExpiryAlert[];
  dismissCaeAlert: (invoiceId: number) => void;
}

const noop = async () => {};

const INVOICE_ENDPOINT_CANDIDATES = ['/invoices', '/billing/invoices'];

export const InvoicesContext = createContext<InvoicesContextValue>({
  invoices: [],
  loadInvoices: noop,
  updateInvoiceStatus: async () => false,
  refreshInvoice: async () => null,
  requestInvoiceReprint: async () => false,
  caeAlerts: [],
  dismissCaeAlert: () => {},
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

export const normaliseAfipEvent = (raw: unknown): AfipEvent | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const idCandidates = [
    record['id'],
    record['event_id'],
    record['uuid'],
    record['log_id'],
  ];
  let id: string | null = null;
  for (const candidate of idCandidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }
    id = String(candidate);
    break;
  }

  if (!id) {
    return null;
  }

  return {
    id,
    ...record,
  } as AfipEvent;
};

const mergeInvoiceWithMetadata = (
  invoice: Invoice,
  metadata?: AfipInvoiceMetadata | null
): Invoice => {
  if (!metadata) {
    return invoice;
  }

  return {
    ...invoice,
    cae: metadata.cae ?? invoice.cae ?? null,
    cae_due_date: metadata.cae_due_date ?? invoice.cae_due_date ?? null,
    afip_response_payload:
      metadata.afip_response_payload ?? invoice.afip_response_payload,
    afip_events: metadata.afip_events ?? invoice.afip_events ?? [],
  };
};

const normaliseAfipInvoicePayload = (payload: unknown): AfipInvoiceMetadata | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates: Record<string, unknown>[] = [record];

  const nestedKeys = ['data', 'invoice', 'result', 'payload'];
  for (const key of nestedKeys) {
    const value = record[key];
    if (value && typeof value === 'object') {
      candidates.push(value as Record<string, unknown>);
    }
  }

  let cae: string | null = null;
  let caeDueDate: string | null = null;
  let responsePayload: unknown = payload;
  let events: AfipEvent[] = [];

  for (const candidate of candidates) {
    if (!cae) {
      const value = candidate['cae'] ?? candidate['CAE'];
      if (value !== undefined && value !== null && String(value).trim()) {
        cae = String(value);
      }
    }

    if (!caeDueDate) {
      const value =
        candidate['cae_due_date'] ??
        candidate['caeVencimiento'] ??
        candidate['caeDueDate'] ??
        candidate['due_date'];
      if (value !== undefined && value !== null && String(value).trim()) {
        caeDueDate = String(value);
      }
    }

    const eventsRaw =
      candidate['events'] ?? candidate['afip_events'] ?? candidate['logs'];
    if (Array.isArray(eventsRaw)) {
      const parsed = eventsRaw
        .map(normaliseAfipEvent)
        .filter((event): event is AfipEvent => event !== null);
      if (parsed.length > 0) {
        events = parsed;
      }
    }

    const responseCandidate =
      candidate['response'] ??
      candidate['afip_response'] ??
      candidate['afip_response_payload'];
    if (responseCandidate !== undefined) {
      responsePayload = responseCandidate;
    }
  }

  return {
    cae,
    cae_due_date: caeDueDate,
    afip_response_payload: responsePayload,
    afip_events: events,
  };
};

export const InvoicesProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const [invoices, setInvoices] = useCachedState<Invoice[]>('invoices', []);
  const [afipMetadataCache, setAfipMetadataCache] = useCachedState<
    Record<number, AfipInvoiceMetadata>
  >('invoiceAfipMetadata', {});
  const [dismissedCaeAlerts, setDismissedCaeAlerts] = useCachedState<number[]>(
    'dismissedCaeAlerts',
    []
  );
  const [caeAlerts, setCaeAlerts] = useState<CaeExpiryAlert[]>([]);
  const invoicesRef = useRef(invoices);
  const resolvedEndpointRef = useRef<string | null>(null);

  const canListInvoices = permissions.includes('listInvoices');
  const canViewInvoices = permissions.includes('viewInvoice');
  const canUpdateInvoiceStatus = permissions.includes('updateInvoice');
  const canAccessInvoices = canListInvoices || canViewInvoices || canUpdateInvoiceStatus;

  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  useEffect(() => {
    setInvoices(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setInvoices]);

  useEffect(() => {
    if (!canAccessInvoices) {
      setInvoices(prev => (prev.length > 0 ? [] : prev));
    }
  }, [canAccessInvoices, setInvoices]);

  const normaliseHeaders = (input?: HeadersInit): Record<string, string> => {
    if (!input) {
      return {};
    }
    if (input instanceof Headers) {
      return Object.fromEntries(input.entries());
    }
    if (Array.isArray(input)) {
      return Object.fromEntries(input);
    }
    return { ...input };
  };

  const performInvoiceRequest = useCallback(
    async (buildPath: (basePath: string) => string, init?: RequestInit) => {
      if (!token) {
        throw new Error('Token no disponible para facturas');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const candidates = resolvedEndpointRef.current
        ? [
            resolvedEndpointRef.current,
            ...INVOICE_ENDPOINT_CANDIDATES.filter(candidate => candidate !== resolvedEndpointRef.current),
          ]
        : INVOICE_ENDPOINT_CANDIDATES;

      let last404Path: string | null = null;
      let last404Status: number | null = null;

      for (const basePath of candidates) {
        const url = `${BASE_URL}${buildPath(basePath)}`;
        const response = await fetch(url, {
          ...init,
          headers: { ...headers, ...normaliseHeaders(init?.headers) },
        });

        if (response.status === 404) {
          last404Path = buildPath(basePath);
          last404Status = response.status;
          continue;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${buildPath(basePath)} ${text}`);
        }

        resolvedEndpointRef.current = basePath;
        return response;
      }

      const detail = last404Path ? `${last404Status} en ${last404Path}` : 'sin respuesta válida';
      throw new Error(`No se pudo resolver el endpoint de facturas (${detail}).`);
    },
    [token]
  );

  const performAfipRequest = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!token) {
        throw new Error('Token no disponible para AFIP');
      }

      const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...normaliseHeaders(init?.headers),
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${path} ${text}`);
      }

      return response;
    },
    [token]
  );

  const loadInvoices = useCallback(async () => {
    if (!token || !canListInvoices) {
      return;
    }

    try {
      const response = await performInvoiceRequest(basePath => `${basePath}`);
      const payload = await response.json().catch(() => ({}));
      const list = extractInvoiceList(payload)
        .map(toInvoice)
        .filter((invoice): invoice is Invoice => invoice !== null);

      const hydrated = list.map(item =>
        mergeInvoiceWithMetadata(item, afipMetadataCache[item.id])
      );

      setInvoices(sortByNewest(hydrated, getDefaultSortValue));
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }, [afipMetadataCache, canListInvoices, performInvoiceRequest, setInvoices, token]);

  const fetchAfipInvoiceMetadata = useCallback(
    async (id: number): Promise<AfipInvoiceMetadata | null> => {
      try {
        const response = await performAfipRequest(`/afip/invoices/${id}`);
        const payload = await response.json().catch(() => ({}));
        const normalised = normaliseAfipInvoicePayload(payload);
        if (normalised) {
          setAfipMetadataCache(prev => ({ ...prev, [id]: normalised }));
        }
        return normalised;
      } catch (error) {
        console.error('Error fetching AFIP invoice metadata:', error);
        return null;
      }
    },
    [performAfipRequest, setAfipMetadataCache]
  );

  const refreshInvoice = useCallback(
    async (id: number): Promise<Invoice | null> => {
      if (!token || !canAccessInvoices) {
        return null;
      }

      try {
        const response = await performInvoiceRequest(basePath => `${basePath}/${id}`);
        const data = await response.json().catch(() => ({}));
        const list = extractInvoiceList(data);
        let parsed: Invoice | null = null;
        if (list.length > 0) {
          parsed = list.map(toInvoice).find(item => item !== null) ?? null;
        } else {
          parsed = toInvoice(data);
        }

        if (parsed) {
          const afipMetadata =
            (await fetchAfipInvoiceMetadata(parsed.id)) ??
            afipMetadataCache[parsed.id] ??
            null;
          const merged = mergeInvoiceWithMetadata(parsed, afipMetadata);

          setInvoices(prev =>
            ensureSortedByNewest(
              prev.some(item => item.id === merged.id)
                ? prev.map(item => (item.id === merged.id ? { ...item, ...merged } : item))
                : [...prev, merged],
              getDefaultSortValue
            )
          );
          return merged;
        }
      } catch (error) {
        console.error('Error refreshing invoice:', error);
      }

      return null;
    },
    [
      afipMetadataCache,
      canAccessInvoices,
      fetchAfipInvoiceMetadata,
      performInvoiceRequest,
      setInvoices,
      token,
    ]
  );

  const updateInvoiceStatus = useCallback(
    async (id: number, status: InvoiceStatus): Promise<boolean> => {
      if (!token || !canUpdateInvoiceStatus) {
        return false;
      }

      const request = async (method: 'PATCH' | 'PUT', body: Record<string, unknown>) => {
        try {
          const response = await performInvoiceRequest(
            basePath => `${basePath}/${id}`,
            {
              method,
              body: JSON.stringify(body),
            }
          );

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
    [canUpdateInvoiceStatus, performInvoiceRequest, setInvoices, token]
  );

  const requestInvoiceReprint = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) {
        return false;
      }

      try {
        await performAfipRequest(`/afip/invoices/${id}/reprint`, {
          method: 'POST',
        });
        await refreshInvoice(id);
        setDismissedCaeAlerts(prev => prev.filter(item => item !== id));
        return true;
      } catch (error) {
        console.error('Error requesting invoice reprint:', error);
        return false;
      }
    },
    [performAfipRequest, refreshInvoice, setDismissedCaeAlerts, token]
  );

  useEffect(() => {
    if (token && canListInvoices) {
      void loadInvoices();
    }
  }, [canListInvoices, loadInvoices, token]);

  useEffect(() => {
    const now = new Date();
    const threshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const alerts: CaeExpiryAlert[] = invoices
      .map(invoice => mergeInvoiceWithMetadata(invoice, afipMetadataCache[invoice.id]))
      .map(invoice => {
        const caeDueDate = invoice.cae_due_date ?? afipMetadataCache[invoice.id]?.cae_due_date ?? null;
        if (!caeDueDate) {
          return null;
        }

        const parsed = new Date(caeDueDate);
        if (Number.isNaN(parsed.getTime())) {
          return null;
        }

        if (parsed <= now || parsed > threshold) {
          return null;
        }

        const days = Math.ceil((parsed.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const invoiceNumber =
          invoice.number ??
          invoice.invoice_number ??
          invoice.code ??
          `#${invoice.id}`;

        return {
          invoiceId: invoice.id,
          cae: invoice.cae ?? afipMetadataCache[invoice.id]?.cae ?? null,
          caeDueDate: parsed.toISOString(),
          daysUntilExpiration: days,
          invoiceNumber,
        } satisfies CaeExpiryAlert;
      })
      .filter((alert): alert is CaeExpiryAlert => alert !== null)
      .filter(alert => !dismissedCaeAlerts.includes(alert.invoiceId));

    setCaeAlerts(alerts);
  }, [afipMetadataCache, dismissedCaeAlerts, invoices]);

  const dismissCaeAlert = useCallback(
    (invoiceId: number) => {
      setDismissedCaeAlerts(prev =>
        prev.includes(invoiceId) ? prev : [...prev, invoiceId]
      );
      setCaeAlerts(prev => prev.filter(alert => alert.invoiceId !== invoiceId));
    },
    [setCaeAlerts, setDismissedCaeAlerts]
  );

  const contextValue = useMemo(
    () => ({
      invoices,
      loadInvoices,
      updateInvoiceStatus,
      refreshInvoice,
      requestInvoiceReprint,
      caeAlerts,
      dismissCaeAlert,
    }),
    [
      caeAlerts,
      dismissCaeAlert,
      invoices,
      loadInvoices,
      refreshInvoice,
      requestInvoiceReprint,
      updateInvoiceStatus,
    ]
  );

  return <InvoicesContext.Provider value={contextValue}>{children}</InvoicesContext.Provider>;
};
