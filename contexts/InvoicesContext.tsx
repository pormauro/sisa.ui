import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue } from '@/utils/sort';

export type InvoiceStatus = 'issued' | 'paid' | 'cancelled' | string;

export interface InvoiceItem {
  id?: number;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  vat_rate?: number | null;
  vat_amount?: number | null;
  total_amount?: number | null;
  measure_unit?: string | null;
  [key: string]: unknown;
}

export interface InvoiceVatBreakdownEntry {
  id?: number;
  vat_rate?: number | null;
  taxable_amount?: number | null;
  vat_amount?: number | null;
  total_amount?: number | null;
  [key: string]: unknown;
}

export interface InvoiceTributeEntry {
  id?: number;
  type?: string | number | null;
  description?: string | null;
  amount?: number | null;
  base_amount?: number | null;
  tax_id?: string | number | null;
  [key: string]: unknown;
}

export interface Invoice {
  id: number;
  number?: string | null;
  invoice_number?: string | null;
  code?: string | null;
  description?: string | null;
  notes?: string | null;
  total?: number | null;
  amount?: number | null;
  total_amount?: number | null;
  subtotal?: number | null;
  vat_amount?: number | null;
  status?: InvoiceStatus | null;
  state?: InvoiceStatus | null;
  issued_at?: string | null;
  issue_date?: string | null;
  date?: string | null;
  due_at?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  client_id?: number | null;
  clientId?: number | null;
  client_name?: string | null;
  provider_id?: number | null;
  providerId?: number | null;
  provider_name?: string | null;
  currency?: string | null;
  exchange_rate?: number | null;
  items?: InvoiceItem[] | null;
  vat_breakdown?: InvoiceVatBreakdownEntry[] | null;
  tributes?: InvoiceTributeEntry[] | null;
  [key: string]: unknown;
}

interface InvoicesContextValue {
  invoices: Invoice[];
  loadInvoices: () => Promise<void>;
  refreshInvoice: (id: number) => Promise<Invoice | null>;
}

const noop = async () => {};

const INVOICE_ENDPOINT_CANDIDATES = ['/comprobantes', '/invoices', '/billing/invoices'];

export const InvoicesContext = createContext<InvoicesContextValue>({
  invoices: [],
  loadInvoices: noop,
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

const parseNumeric = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const parseString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const parseVatBreakdown = (value: unknown): InvoiceVatBreakdownEntry[] | undefined => {
  if (!value) {
    return undefined;
  }

  const normaliseEntry = (entry: unknown): InvoiceVatBreakdownEntry | null => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const vatRate = parseNumeric(record['vat_rate'] ?? record['rate'] ?? record['aliquot']);
    const taxable = parseNumeric(record['taxable_amount'] ?? record['net_amount']);
    const vatAmount = parseNumeric(record['vat_amount'] ?? record['tax_amount']);
    if (vatRate === undefined || taxable === undefined || vatAmount === undefined) {
      return null;
    }
    const id = parseNumeric(record['id']);
    const totalAmount = parseNumeric(record['total_amount']);
    return {
      id: typeof id === 'number' ? id : undefined,
      vat_rate: vatRate,
      taxable_amount: taxable,
      vat_amount: vatAmount,
      total_amount: totalAmount,
    };
  };

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(normaliseEntry).filter((entry): entry is InvoiceVatBreakdownEntry => Boolean(entry));
      }
    } catch (error) {
      console.warn('No se pudo parsear vat_breakdown:', error);
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    return value.map(normaliseEntry).filter((entry): entry is InvoiceVatBreakdownEntry => Boolean(entry));
  }

  if (typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.map(normaliseEntry).filter((entry): entry is InvoiceVatBreakdownEntry => Boolean(entry));
  }

  return undefined;
};

const parseTributes = (value: unknown): InvoiceTributeEntry[] | undefined => {
  if (!value) {
    return undefined;
  }

  const normaliseEntry = (entry: unknown): InvoiceTributeEntry | null => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const amount = parseNumeric(record['amount'] ?? record['tax_amount']);
    if (amount === undefined) {
      return null;
    }
    const baseAmount = parseNumeric(record['base_amount'] ?? record['base']);
    const id = parseNumeric(record['id']);
    return {
      id: typeof id === 'number' ? id : undefined,
      type: record['type'] ?? record['tribute_type'] ?? record['code'] ?? null,
      description:
        typeof record['description'] === 'string'
          ? record['description']
          : typeof record['name'] === 'string'
            ? record['name']
            : null,
      amount,
      base_amount: baseAmount,
      tax_id: record['tax_id'] ?? record['taxId'] ?? null,
    };
  };

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(normaliseEntry).filter((entry): entry is InvoiceTributeEntry => Boolean(entry));
      }
    } catch (error) {
      console.warn('No se pudo parsear tributos:', error);
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    return value.map(normaliseEntry).filter((entry): entry is InvoiceTributeEntry => Boolean(entry));
  }

  if (typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.map(normaliseEntry).filter((entry): entry is InvoiceTributeEntry => Boolean(entry));
  }

  return undefined;
};

const parseItems = (value: unknown): InvoiceItem[] | undefined => {
  if (!value) {
    return undefined;
  }

  const normaliseEntry = (entry: unknown): InvoiceItem | null => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const quantity = parseNumeric(record['quantity']);
    const unitPrice = parseNumeric(record['unit_price'] ?? record['unitPrice'] ?? record['price']);
    const vatRate = parseNumeric(record['vat_rate'] ?? record['rate'] ?? record['aliquot']);
    const id = parseNumeric(record['id']);

    return {
      id: typeof id === 'number' ? id : undefined,
      description:
        typeof record['description'] === 'string'
          ? record['description']
          : typeof record['name'] === 'string'
            ? record['name']
            : undefined,
      quantity: quantity ?? null,
      unit_price: unitPrice ?? null,
      vat_rate: vatRate ?? null,
      vat_amount: parseNumeric(record['vat_amount'] ?? record['iva_amount']) ?? null,
      total_amount: parseNumeric(record['total_amount']) ?? null,
      measure_unit:
        typeof record['measure_unit'] === 'string'
          ? record['measure_unit']
          : typeof record['unit'] === 'string'
            ? record['unit']
            : null,
    };
  };

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(normaliseEntry).filter((entry): entry is InvoiceItem => Boolean(entry));
      }
    } catch (error) {
      console.warn('No se pudo parsear items de factura:', error);
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    return value.map(normaliseEntry).filter((entry): entry is InvoiceItem => Boolean(entry));
  }

  if (typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.map(normaliseEntry).filter((entry): entry is InvoiceItem => Boolean(entry));
  }

  return undefined;
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

  const invoice: Invoice = {
    ...record,
    id,
    number: parseString(record['number']) ?? parseString(record['invoice_number']) ?? null,
    invoice_number: parseString(record['invoice_number']) ?? null,
    code: parseString(record['code']) ?? null,
    description: parseString(record['description']) ?? null,
    notes: parseString(record['notes']) ?? null,
    total: parseNumeric(record['total']) ?? null,
    amount: parseNumeric(record['amount']) ?? null,
    total_amount: parseNumeric(record['total_amount']) ?? null,
    subtotal: parseNumeric(record['subtotal']) ?? null,
    vat_amount: parseNumeric(record['vat_amount']) ?? null,
    status: (parseString(record['status']) as InvoiceStatus | undefined) ?? null,
    state: (parseString(record['state']) as InvoiceStatus | undefined) ?? null,
    issued_at:
      parseString(record['issued_at']) ??
      parseString(record['issue_date']) ??
      parseString(record['date']) ??
      null,
    issue_date: parseString(record['issue_date']) ?? null,
    date: parseString(record['date']) ?? null,
    due_at: parseString(record['due_at']) ?? parseString(record['due_date']) ?? null,
    due_date: parseString(record['due_date']) ?? null,
    created_at: parseString(record['created_at']) ?? null,
    updated_at: parseString(record['updated_at']) ?? null,
    client_id: parseNumeric(record['client_id']) ?? parseNumeric(record['clientId']) ?? null,
    clientId: parseNumeric(record['clientId']) ?? parseNumeric(record['client_id']) ?? null,
    client_name: parseString(record['client_name']) ?? null,
    provider_id: parseNumeric(record['provider_id']) ?? parseNumeric(record['providerId']) ?? null,
    providerId: parseNumeric(record['providerId']) ?? parseNumeric(record['provider_id']) ?? null,
    provider_name: parseString(record['provider_name']) ?? null,
    currency: parseString(record['currency']) ?? null,
    exchange_rate: parseNumeric(record['exchange_rate']) ?? null,
    items: parseItems(record['items']) ?? null,
    vat_breakdown: parseVatBreakdown(record['vat_breakdown']) ?? null,
    tributes: parseTributes(record['tributes']) ?? null,
  };

  return invoice;
};

const parseInvoiceCollection = (payload: unknown): Invoice[] => {
  const list = extractInvoiceList(payload);
  const byId = new Map<number, Invoice>();

  for (const entry of list) {
    const invoice = toInvoice(entry);
    if (!invoice) {
      continue;
    }
    const existing = byId.get(invoice.id);
    byId.set(invoice.id, existing ? { ...existing, ...invoice } : invoice);
  }

  return ensureSortedByNewest(Array.from(byId.values()), getDefaultSortValue);
};

export const InvoicesProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const [invoices, setInvoices] = useCachedState<Invoice[]>('invoices', []);
  const endpointRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  const canList = permissions.includes('listInvoices') || permissions.includes('viewInvoice');

  useEffect(() => {
    if (!canList) {
      setInvoices([]);
    }
  }, [canList, setInvoices]);

  const buildHeaders = useCallback((): HeadersInit => {
    if (!token) {
      return { Accept: 'application/json' };
    }
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const withCandidateOrder = useCallback(
    (preferred?: string | null): string[] => {
      if (preferred && INVOICE_ENDPOINT_CANDIDATES.includes(preferred)) {
        return [
          preferred,
          ...INVOICE_ENDPOINT_CANDIDATES.filter(candidate => candidate !== preferred),
        ];
      }
      return [...INVOICE_ENDPOINT_CANDIDATES];
    },
    []
  );

  const loadInvoices = useCallback(async () => {
    if (!token || !canList || isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    try {
      const headers = buildHeaders();
      const candidates = withCandidateOrder(endpointRef.current);
      let lastError: Error | null = null;

      for (const candidate of candidates) {
        try {
          const response = await fetch(`${BASE_URL}${candidate}`, {
            headers,
          });

          if (response.status === 404) {
            continue;
          }

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status} ${candidate} ${text}`.trim());
          }

          const payload = await response.json().catch(() => ({}));
          const parsed = parseInvoiceCollection(payload);
          endpointRef.current = candidate;
          setInvoices(parsed);
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Error cargando facturas');
          console.error('Error loading invoices:', lastError.message);
        }
      }

      if (lastError) {
        throw lastError;
      }
    } catch (error) {
      console.error('Fallo general al cargar facturas:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [buildHeaders, canList, setInvoices, token, withCandidateOrder]);

  const refreshInvoice = useCallback(
    async (id: number): Promise<Invoice | null> => {
      if (!token || !canList) {
        return invoices.find(invoice => invoice.id === id) ?? null;
      }

      const headers = buildHeaders();
      const candidates = withCandidateOrder(endpointRef.current);
      let lastError: Error | null = null;

      for (const candidate of candidates) {
        try {
          const response = await fetch(`${BASE_URL}${candidate}/${id}`, {
            headers,
          });

          if (response.status === 404) {
            continue;
          }

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status} ${candidate}/${id} ${text}`.trim());
          }

          const payload = await response.json().catch(() => ({}));
          const invoice = toInvoice(payload);
          if (!invoice) {
            return null;
          }

          endpointRef.current = candidate;
          setInvoices(previous => {
            const map = new Map<number, Invoice>();
            previous.forEach(item => map.set(item.id, item));
            const existing = map.get(invoice.id);
            map.set(invoice.id, existing ? { ...existing, ...invoice } : invoice);
            return ensureSortedByNewest(Array.from(map.values()), getDefaultSortValue);
          });
          return invoice;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Error actualizando factura');
          console.error('Error refreshing invoice:', lastError.message);
        }
      }

      if (lastError) {
        console.error('No se pudo actualizar la factura solicitada:', lastError.message);
      }

      return null;
    },
    [buildHeaders, canList, invoices, setInvoices, token, withCandidateOrder]
  );

  const value = useMemo<InvoicesContextValue>(
    () => ({ invoices, loadInvoices, refreshInvoice }),
    [invoices, loadInvoices, refreshInvoice]
  );

  return <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>;
};
