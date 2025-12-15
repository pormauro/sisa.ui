import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { BootstrapResult } from '@/contexts/bootstrapTypes';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { ensureSortedByNewest, sortByNewest, SortableDate } from '@/utils/sort';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'canceled' | (string & {});

export interface InvoiceHistoryEntry {
  id: number;
  invoice_id: number;
  event_type: string | null;
  description: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
  user_id?: number | null;
  username?: string | null;
}

export interface InvoiceItem {
  id?: number;
  concept_code?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  job_id?: number | null;
  product_id?: number | null;
  invoice_id?: number | null;
  discount_amount?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  order_index?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface Invoice {
  id: number;
  status: InvoiceStatus;
  client_id: number | null;
  job_ids: number[];
  invoice_number?: string | null;
  total_amount?: number | null;
  subtotal_amount?: number | null;
  tax_amount?: number | null;
  tax_percentage?: number | null;
  currency?: string | null;
  company_id?: number | null;
  invoice_date?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  voided_at?: string | null;
  invoice_pdf_file_id?: number | null;
  metadata?: Record<string, unknown> | null;
  items?: InvoiceItem[];
  attached_files?: number[] | string | null;
}

export type InvoicePayload = Record<string, unknown> & {
  client_id?: number | string | null;
  status?: InvoiceStatus;
  job_ids?: unknown;
  invoice_number?: string | null;
  invoice_date?: string | null;
  total_amount?: number | string | null;
  subtotal_amount?: number | string | null;
  tax_amount?: number | string | null;
  currency?: string | null;
  currency_code?: string | null;
  company_id?: number | string | null;
  issue_date?: string | null;
  due_date?: string | null;
  tax_percentage?: number | string | null;
  metadata?: Record<string, unknown> | null;
  items?: unknown;
  concepts?: unknown;
  attached_files?: unknown;
};

interface InvoicesContextValue {
  invoices: Invoice[];
  loadInvoices: () => Promise<BootstrapResult>;
  addInvoice: (payload: InvoicePayload) => Promise<Invoice | null>;
  updateInvoice: (id: number, payload: InvoicePayload) => Promise<boolean>;
  deleteInvoice: (id: number) => Promise<boolean>;
  voidInvoice: (id: number, reason?: string | null) => Promise<boolean>;
  issueInvoice: (id: number, payload?: Record<string, unknown> | null) => Promise<boolean>;
  getInvoiceHistory: (id: number) => Promise<InvoiceHistoryEntry[]>;
}

const defaultContext: InvoicesContextValue = {
  invoices: [],
  loadInvoices: async () => ({ source: 'unknown' }),
  addInvoice: async () => null,
  updateInvoice: async () => false,
  deleteInvoice: async () => false,
  voidInvoice: async () => false,
  issueInvoice: async () => false,
  getInvoiceHistory: async () => [],
};

export const InvoicesContext = createContext<InvoicesContextValue>(defaultContext);

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const parseJobIds = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .map(item => toNullableNumber(item))
      .filter((item): item is number => item !== null);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => toNullableNumber(item))
          .filter((item): item is number => item !== null);
      }
    } catch (error) {
      // The string may be a comma separated list.
    }

    return trimmed
      .split(',')
      .map(part => toNullableNumber(part))
      .filter((item): item is number => item !== null);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? [value] : [];
  }

  if (value && typeof value === 'object') {
    if ('job_ids' in (value as Record<string, unknown>)) {
      return parseJobIds((value as Record<string, unknown>).job_ids);
    }
    if ('jobs' in (value as Record<string, unknown>)) {
      return parseJobIds((value as Record<string, unknown>).jobs);
    }
  }

  return [];
};

const parseInvoiceItems = (value: unknown): InvoiceItem[] => {
  const ensureItem = (input: unknown): InvoiceItem => {
    if (!input || typeof input !== 'object') {
      return {};
    }

    const item = input as Record<string, unknown>;
    return {
      id: toNullableNumber(item.id ?? item.concept_id ?? item.identifier ?? null) ?? undefined,
      concept_code:
        typeof item.concept_code === 'string'
          ? item.concept_code
          : typeof item.code === 'string'
          ? item.code
          : null,
      description: typeof item.description === 'string' ? item.description : null,
      quantity: toNullableNumber(item.quantity ?? item.qty ?? null),
      unit_price: toNullableNumber(item.unit_price ?? item.price ?? item.amount ?? null),
      job_id: toNullableNumber(item.job_id ?? item.related_job_id ?? null),
      product_id: toNullableNumber(item.product_id ?? item.service_id ?? null) ?? undefined,
      invoice_id: toNullableNumber(item.invoice_id ?? null) ?? undefined,
      discount_amount: toNullableNumber(item.discount_amount ?? item.discount ?? null),
      tax_amount: toNullableNumber(item.tax_amount ?? item.tax ?? null),
      total_amount: toNullableNumber(item.total_amount ?? item.total ?? null),
      order_index: toNullableNumber(item.order_index ?? item.sort_order ?? null),
      metadata:
        item.metadata && typeof item.metadata === 'object' ? (item.metadata as Record<string, unknown>) : null,
    };
  };

  if (Array.isArray(value)) {
    return value.map(item => ensureItem(item));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ensureItem(item));
      }
    } catch (error) {
      // ignore parsing errors and return empty list
    }
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    return record.items.map(item => ensureItem(item));
  }
  if (Array.isArray(record.concepts)) {
    return record.concepts.map(item => ensureItem(item));
  }

  return [];
};

const parseAttachedFiles = (value: unknown): number[] | string | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map(item => toNullableNumber(item))
            .filter((item): item is number => item !== null);
        }
      } catch (error) {
        return trimmed;
      }
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => toNullableNumber(item))
      .filter((item): item is number => item !== null);
  }

  return null;
};

const normalizeInvoiceStatus = (value: unknown): InvoiceStatus => {
  if (typeof value !== 'string') {
    return 'draft';
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'draft':
    case 'borrador':
      return 'draft';
    case 'issued':
    case 'emitido':
    case 'emitida':
      return 'issued';
    case 'paid':
    case 'pagado':
    case 'pagada':
      return 'paid';
    case 'canceled':
    case 'cancelled':
    case 'cancelado':
    case 'cancelada':
    case 'void':
    case 'anulado':
    case 'anulada':
      return 'canceled';
    default:
      return normalized as InvoiceStatus;
  }
};

const parseInvoice = (raw: Record<string, unknown>): Invoice => {
  const jobIds = parseJobIds(
    raw.job_ids ?? raw.jobs ?? raw.related_jobs ?? raw.job_references ?? raw.linked_jobs ?? [],
  );
  const items = parseInvoiceItems(raw.items ?? raw.concepts ?? raw.lines ?? []);
  const metadata =
    raw.metadata && typeof raw.metadata === 'object'
      ? (raw.metadata as Record<string, unknown>)
      : raw.meta && typeof raw.meta === 'object'
      ? (raw.meta as Record<string, unknown>)
      : null;
  const metadataTaxCandidate = metadata
    ? metadata['total_tax_percentage'] ??
      metadata['tax_percentage'] ??
      metadata['taxPercent'] ??
      metadata['totalTaxPercentage'] ??
      null
    : null;
  const taxPercentage = toNullableNumber(
    raw.tax_percentage ??
      raw.taxPercent ??
      raw.total_tax_percentage ??
      metadataTaxCandidate ??
      null,
  );

  const pdfFileId = toNullableNumber(
    raw.invoice_pdf_file_id ??
      raw.pdf_file_id ??
      raw.invoice_pdf_id ??
      raw.file_id ??
      (metadata ? metadata['invoice_pdf_file_id'] ?? metadata['pdf_file_id'] ?? metadata['invoice_pdf_id'] ?? metadata['file_id'] ?? null : null),
  );

  return {
    id: toNumber(raw.id ?? raw.invoice_id ?? raw.identifier ?? 0),
    status: normalizeInvoiceStatus(raw.status ?? raw.invoice_status ?? 'draft'),
    client_id: toNullableNumber(raw.client_id ?? raw.customer_id ?? null),
    job_ids: jobIds,
    invoice_number:
      typeof raw.invoice_number === 'string'
        ? raw.invoice_number
        : typeof raw.number === 'string'
        ? raw.number
        : null,
    total_amount: toNullableNumber(raw.total_amount ?? raw.total ?? raw.grand_total ?? null),
    currency:
      typeof raw.currency === 'string'
        ? raw.currency
        : typeof raw.currency_code === 'string'
        ? raw.currency_code
        : null,
    invoice_date:
      typeof raw.invoice_date === 'string'
        ? raw.invoice_date
        : typeof raw.issue_date === 'string'
        ? raw.issue_date
        : typeof raw.issued_at === 'string'
        ? raw.issued_at
        : null,
    issue_date:
      typeof raw.issue_date === 'string'
        ? raw.issue_date
        : typeof raw.issued_at === 'string'
        ? raw.issued_at
        : null,
    due_date: typeof raw.due_date === 'string' ? raw.due_date : null,
    created_at:
      typeof raw.created_at === 'string'
        ? raw.created_at
        : typeof raw.createdOn === 'string'
        ? raw.createdOn
        : null,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    voided_at:
      typeof raw.voided_at === 'string'
        ? raw.voided_at
        : typeof raw.cancelled_at === 'string'
        ? raw.cancelled_at
        : null,
    invoice_pdf_file_id: pdfFileId,
    subtotal_amount: toNullableNumber(raw.subtotal_amount ?? raw.subtotal ?? null),
    tax_amount: toNullableNumber(raw.tax_amount ?? raw.taxes ?? null),
    tax_percentage: taxPercentage,
    company_id: toNullableNumber(raw.company_id ?? raw.organization_id ?? null),
    metadata,
    items,
    attached_files: parseAttachedFiles(raw.attached_files ?? raw.attachments ?? null),
  };
};

const getInvoiceSortValue = (invoice: Invoice): SortableDate => {
  if (invoice.invoice_date) {
    return invoice.invoice_date;
  }
  if (invoice.issue_date) {
    return invoice.issue_date;
  }
  if (invoice.created_at) {
    return invoice.created_at;
  }
  if (invoice.updated_at) {
    return invoice.updated_at;
  }
  return invoice.id;
};

const serializeAttachedFiles = (value: number[] | string | null | undefined) => {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.warn('No se pudo interpretar la respuesta JSON del endpoint de facturas.', error);
    return null;
  }
};

const extractHistoryArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return [];
  }

  const record = data as Record<string, unknown>;
  const candidates = ['history', 'data', 'items', 'results'];
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const parseInvoiceHistoryEntry = (raw: Record<string, unknown>): InvoiceHistoryEntry => ({
  id: toNumber(raw.id ?? raw.history_id ?? raw.identifier ?? 0),
  invoice_id: toNumber(raw.invoice_id ?? raw.parent_id ?? raw.record_id ?? 0),
  event_type:
    typeof raw.event_type === 'string'
      ? raw.event_type
      : typeof raw.type === 'string'
      ? raw.type
      : typeof raw.action === 'string'
      ? raw.action
      : null,
  description:
    typeof raw.description === 'string'
      ? raw.description
      : typeof raw.detail === 'string'
      ? raw.detail
      : typeof raw.message === 'string'
      ? raw.message
      : null,
  payload:
    raw.payload && typeof raw.payload === 'object'
      ? (raw.payload as Record<string, unknown>)
      : raw.changes && typeof raw.changes === 'object'
      ? (raw.changes as Record<string, unknown>)
      : null,
  created_at:
    typeof raw.created_at === 'string'
      ? raw.created_at
      : typeof raw.timestamp === 'string'
      ? raw.timestamp
      : typeof raw.date === 'string'
      ? raw.date
      : null,
  user_id: toNullableNumber(raw.user_id ?? raw.author_id ?? raw.updated_by ?? null),
  username:
    typeof raw.username === 'string'
      ? raw.username
      : typeof raw.user_name === 'string'
      ? raw.user_name
      : typeof raw.user === 'string'
      ? raw.user
      : null,
});

const sortHistoryEntries = (entries: InvoiceHistoryEntry[]): InvoiceHistoryEntry[] => {
  return [...entries].sort((a, b) => {
    const getTime = (value: string | null | undefined): number => {
      if (!value) {
        return 0;
      }
      const normalized = value.includes('T') || value.includes(' ')
        ? value.replace(' ', 'T')
        : `${value}T00:00:00`;
      const time = new Date(normalized).getTime();
      if (Number.isNaN(time)) {
        return 0;
      }
      return time;
    };

    return getTime(b.created_at) - getTime(a.created_at);
  });
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

const extractInvoiceId = (data: unknown): number | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const id = extractInvoiceId(item);
      if (id !== null) {
        return id;
      }
    }
    return null;
  }

  const record = data as Record<string, unknown>;
  const directKeys = ['invoice_id', 'invoiceId', 'id'];
  for (const key of directKeys) {
    if (key in record) {
      const candidate = toNullableNumber(record[key]);
      if (candidate !== null) {
        return candidate;
      }
    }
  }

  const nestedKeys = ['invoice', 'data', 'result'];
  for (const nestedKey of nestedKeys) {
    const nested = record[nestedKey];
    const nestedId = extractInvoiceId(nested);
    if (nestedId !== null) {
      return nestedId;
    }
  }

  return null;
};

const sanitizeInvoiceItemForPayload = (item: InvoiceItem | Record<string, unknown>): Record<string, unknown> => {
  const raw = item as Record<string, unknown>;
  const base: Record<string, unknown> = {
    concept_code:
      typeof raw.concept_code === 'string'
        ? raw.concept_code
        : typeof raw.code === 'string'
        ? raw.code
        : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    quantity: toNullableNumber(raw.quantity ?? raw.qty ?? null),
    unit_price: toNullableNumber(raw.unit_price ?? raw.price ?? raw.amount ?? null),
    job_id: toNullableNumber(raw.job_id ?? raw.related_job_id ?? null),
    product_id: toNullableNumber(raw.product_id ?? raw.service_id ?? null),
    invoice_id: toNullableNumber(raw.invoice_id ?? null),
    discount_amount: toNullableNumber(raw.discount_amount ?? raw.discount ?? null),
    tax_amount: toNullableNumber(raw.tax_amount ?? raw.tax ?? null),
    total_amount: toNullableNumber(raw.total_amount ?? raw.total ?? null),
    order_index: toNullableNumber(raw.order_index ?? raw.sort_order ?? null),
  };

  if (raw.id) {
    base.id = toNullableNumber(raw.id);
  }

  if (raw.metadata && typeof raw.metadata === 'object') {
    base.metadata = raw.metadata;
  }

  const cleaned: Record<string, unknown> = {};
  Object.entries(base).forEach(([key, value]) => {
    if (typeof value === 'undefined' || value === null) {
      return;
    }
    cleaned[key] = value;
  });

  return cleaned;
};

const prepareInvoicePayload = (payload: InvoicePayload): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...payload };

  if ('client_id' in normalized) {
    normalized.client_id = toNullableNumber(normalized.client_id ?? null);
  }

  if ('company_id' in normalized) {
    normalized.company_id = toNullableNumber(normalized.company_id ?? null);
  }

  if ('invoice_date' in normalized) {
    normalized.invoice_date = typeof normalized.invoice_date === 'string'
      ? normalized.invoice_date
      : null;
  }

  if ('issue_date' in normalized) {
    normalized.issue_date = typeof normalized.issue_date === 'string'
      ? normalized.issue_date
      : null;
  }

  if ('total_amount' in normalized) {
    normalized.total_amount = toNullableNumber(normalized.total_amount ?? null);
  }

  if ('subtotal_amount' in normalized) {
    normalized.subtotal_amount = toNullableNumber(normalized.subtotal_amount ?? null);
  }

  if ('tax_amount' in normalized) {
    normalized.tax_amount = toNullableNumber(normalized.tax_amount ?? null);
  }

  if ('tax_percentage' in normalized) {
    normalized.tax_percentage = toNullableNumber(normalized.tax_percentage ?? null);
  }

  if ('currency' in normalized && !('currency_code' in normalized)) {
    const value = normalized.currency;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      normalized.currency_code = trimmed ? trimmed : null;
    } else {
      normalized.currency_code = null;
    }
    delete normalized.currency;
  }

  if ('currency_code' in normalized) {
    const value = normalized.currency_code;
    normalized.currency_code = typeof value === 'string' ? value.trim() || null : null;
  }

  if ('job_ids' in normalized) {
    const ids = parseJobIds(normalized.job_ids);
    normalized.job_ids = ids;
  }

  if ('items' in normalized) {
    const items = parseInvoiceItems(normalized.items);
    normalized.items = items.map(item => sanitizeInvoiceItemForPayload(item));
  }

  if ('concepts' in normalized) {
    const concepts = parseInvoiceItems(normalized.concepts);
    normalized.concepts = concepts.map(item => sanitizeInvoiceItemForPayload(item));
  }

  if ('attached_files' in normalized) {
    normalized.attached_files = serializeAttachedFiles(
      parseAttachedFiles(normalized.attached_files as unknown),
    );
  }

  return normalized;
};

export const InvoicesProvider = ({ children }: { children: ReactNode }) => {
  const [invoices, setInvoices, invoicesHydrated] = useCachedState<Invoice[]>('invoices', []);
  const { token } = useContext(AuthContext);
  const hasBootstrappedRef = useRef(false);
  const previousTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setInvoices(prev => ensureSortedByNewest(prev, getInvoiceSortValue, invoice => invoice.id));
  }, [setInvoices]);

  const loadInvoices = useCallback(async (): Promise<BootstrapResult> => {
    if (!token) {
      setInvoices([]);
      return { source: 'skipped' };
    }

    try {
      const response = await fetch(`${BASE_URL}/invoices`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = await response.json();
      const rawInvoices: unknown =
        (data && typeof data === 'object' && 'invoices' in data && (data as any).invoices) ||
        (data && typeof data === 'object' && 'data' in data && (data as any).data) ||
        [];

      const parsed = Array.isArray(rawInvoices)
        ? rawInvoices.map(item => parseInvoice(item as Record<string, unknown>))
        : [];

      setInvoices(sortByNewest(parsed, getInvoiceSortValue, invoice => invoice.id));
      return { source: 'server' };
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar facturas, se solicitará uno nuevo.');
        return { source: 'failed', error: 'Token expirado al cargar facturas.' };
      }
      console.error('Error loading invoices:', error);
      return {
        source: 'failed',
        error: error instanceof Error ? error.message : 'No fue posible cargar las facturas.',
      };
    }
  }, [setInvoices, token]);

  useEffect(() => {
    if (!token) {
      hasBootstrappedRef.current = false;
      previousTokenRef.current = null;
      return;
    }

    if (previousTokenRef.current !== token) {
      hasBootstrappedRef.current = false;
      previousTokenRef.current = token;
    }

    if (!invoicesHydrated || hasBootstrappedRef.current) {
      return;
    }

    hasBootstrappedRef.current = true;
    void loadInvoices();
  }, [invoicesHydrated, loadInvoices, token]);

  const addInvoice = useCallback(
    async (payload: InvoicePayload): Promise<Invoice | null> => {
      if (!token) {
        return null;
      }

      try {
        const body = prepareInvoicePayload(payload);
        const response = await fetch(`${BASE_URL}/invoices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        await ensureAuthResponse(response);
        const data = await parseJsonSafely(response);
        const fallbackId = extractInvoiceId(data) ?? getIdFromLocationHeader(response);

        let createdRaw: Record<string, unknown> | null = null;
        if (data && typeof data === 'object') {
          if ('invoice' in data && data.invoice) {
            createdRaw = data.invoice as Record<string, unknown>;
          } else if ('data' in data && data.data && typeof data.data === 'object') {
            createdRaw = data.data as Record<string, unknown>;
          } else if ('invoice_id' in data) {
            createdRaw = { ...body, id: (data as any).invoice_id } as Record<string, unknown>;
          } else if ('id' in data) {
            createdRaw = { ...body, id: (data as any).id } as Record<string, unknown>;
          }
        }

        if (!createdRaw && fallbackId !== null) {
          createdRaw = { ...body, id: fallbackId };
        }

        if (createdRaw) {
          const createdInvoice = parseInvoice(createdRaw);
          setInvoices(prev =>
            ensureSortedByNewest(
              [...prev.filter(invoice => invoice.id !== createdInvoice.id), createdInvoice],
              getInvoiceSortValue,
              invoice => invoice.id,
            ),
          );
          await loadInvoices();
          return createdInvoice;
        }

        if (response.ok) {
          await loadInvoices();
          return parseInvoice({ ...body, id: fallbackId ?? 0 });
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al crear una factura, se solicitará uno nuevo.');
          return null;
        }
        console.error('Error adding invoice:', error);
      }

      return null;
    },
    [loadInvoices, setInvoices, token],
  );

  const updateInvoice = useCallback(
    async (id: number, payload: InvoicePayload): Promise<boolean> => {
      if (!token) {
        return false;
      }

      try {
        const body = prepareInvoicePayload(payload);
        const response = await fetch(`${BASE_URL}/invoices/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        await ensureAuthResponse(response);
        const data = await parseJsonSafely(response);

        let updatedRaw: Record<string, unknown> | null = null;
        if (data && typeof data === 'object') {
          if ('invoice' in data && data.invoice) {
            updatedRaw = data.invoice as Record<string, unknown>;
          } else if ('data' in data && data.data && typeof data.data === 'object') {
            updatedRaw = data.data as Record<string, unknown>;
          } else if ('message' in data) {
            updatedRaw = { ...body, id } as Record<string, unknown>;
          }
        }

        if (!updatedRaw && response.ok) {
          updatedRaw = { ...body, id };
        }

        if (updatedRaw) {
          const updatedInvoice = parseInvoice(updatedRaw);
          setInvoices(prev =>
            ensureSortedByNewest(
              prev.map(invoice => (invoice.id === updatedInvoice.id ? updatedInvoice : invoice)),
              getInvoiceSortValue,
              invoice => invoice.id,
            ),
          );
          await loadInvoices();
          return true;
        }

        if (response.ok) {
          await loadInvoices();
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al actualizar una factura, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error updating invoice:', error);
      }

      return false;
    },
    [loadInvoices, setInvoices, token],
  );

  const deleteInvoice = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) {
        return false;
      }

      try {
        const response = await fetch(`${BASE_URL}/invoices/${id}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);

        if (response.ok) {
          // Consume cuerpo JSON opcional sin fallar cuando la respuesta es 204.
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            try {
              await response.json();
            } catch (error) {
              // respuestas vacías: ignorar
            }
          }

          setInvoices(prev => prev.filter(invoice => invoice.id !== id));
          await loadInvoices();
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al eliminar una factura, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error deleting invoice:', error);
      }

      return false;
    },
    [loadInvoices, setInvoices, token],
  );

  const voidInvoice = useCallback(
    async (id: number, reason?: string | null): Promise<boolean> => {
      if (!token) {
        return false;
      }

      try {
        const response = await fetch(`${BASE_URL}/invoices/${id}/void`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            reason && reason.trim()
              ? {
                  reason: reason.trim(),
                }
              : {},
          ),
        });
        await ensureAuthResponse(response);
        const data = await parseJsonSafely(response);

        let raw: Record<string, unknown> | null = null;
        if (data && typeof data === 'object') {
          if ('invoice' in data && data.invoice) {
            raw = data.invoice as Record<string, unknown>;
          } else if ('data' in data && data.data && typeof data.data === 'object') {
            raw = data.data as Record<string, unknown>;
          } else {
            raw = { id, status: 'canceled', voided_at: new Date().toISOString() };
          }
        }

        if (!raw && response.ok) {
          raw = { id, status: 'canceled', voided_at: new Date().toISOString() };
        }

        if (raw) {
          const parsed = parseInvoice(raw);
          setInvoices(prev =>
            ensureSortedByNewest(
              prev.map(invoice => (invoice.id === parsed.id ? parsed : invoice)),
              getInvoiceSortValue,
              invoice => invoice.id,
            ),
          );
          await loadInvoices();
          return true;
        }

        if (response.ok) {
          await loadInvoices();
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al anular una factura, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error voiding invoice:', error);
      }

      return false;
    },
    [loadInvoices, setInvoices, token],
  );

  const issueInvoice = useCallback(
    async (id: number, payload?: Record<string, unknown> | null): Promise<boolean> => {
      if (!token) {
        return false;
      }

      try {
        const body = payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
        const response = await fetch(`${BASE_URL}/invoices/${id}/issue`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body,
        });
        await ensureAuthResponse(response);
        const data = await parseJsonSafely(response);

        let raw: Record<string, unknown> | null = null;
        if (data && typeof data === 'object') {
          if ('invoice' in data && data.invoice) {
            raw = data.invoice as Record<string, unknown>;
          } else if ('data' in data && data.data && typeof data.data === 'object') {
            raw = data.data as Record<string, unknown>;
          } else {
            raw = data as Record<string, unknown>;
          }
        }

        if (!raw && response.ok) {
          raw = { id, status: 'issued', issue_date: new Date().toISOString() };
        }

        if (raw) {
          const parsed = parseInvoice(raw);
          setInvoices(prev =>
            ensureSortedByNewest(
              prev.map(invoice => (invoice.id === parsed.id ? parsed : invoice)),
              getInvoiceSortValue,
              invoice => invoice.id,
            ),
          );
          await loadInvoices();
          return true;
        }

        if (response.ok) {
          await loadInvoices();
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al emitir una factura, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error issuing invoice:', error);
      }

      return false;
    },
    [loadInvoices, setInvoices, token],
  );

  const getInvoiceHistory = useCallback(
    async (id: number): Promise<InvoiceHistoryEntry[]> => {
      if (!token) {
        return [];
      }

      try {
        const response = await fetch(`${BASE_URL}/invoices/${id}/history`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await parseJsonSafely(response);
        const entries = extractHistoryArray(data)
          .map(item => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
          .filter((record): record is Record<string, unknown> => record !== null)
          .map(record => parseInvoiceHistoryEntry(record));

        return sortHistoryEntries(entries);
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al listar el historial de una factura, se solicitará uno nuevo.');
          return [];
        }
        console.error('Error loading invoice history:', error);
      }

      return [];
    },
    [token],
  );

  return (
    <InvoicesContext.Provider
      value={{
        invoices,
        loadInvoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        voidInvoice,
        issueInvoice,
        getInvoiceHistory,
      }}
    >
      {children}
    </InvoicesContext.Provider>
  );
};
