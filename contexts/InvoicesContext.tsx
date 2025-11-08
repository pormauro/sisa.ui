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
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { ensureSortedByNewest, sortByNewest, SortableDate } from '@/utils/sort';

export type InvoiceStatus = 'draft' | 'issued' | 'void' | (string & {});

export interface InvoiceConcept {
  id?: number;
  concept_code?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  job_id?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface Invoice {
  id: number;
  status: InvoiceStatus;
  client_id: number | null;
  job_ids: number[];
  invoice_number?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  voided_at?: string | null;
  metadata?: Record<string, unknown> | null;
  concepts?: InvoiceConcept[];
  attached_files?: number[] | string | null;
}

export type InvoicePayload = Record<string, unknown> & {
  client_id?: number | string | null;
  status?: InvoiceStatus;
  job_ids?: unknown;
  invoice_number?: string | null;
  total_amount?: number | string | null;
  currency?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  metadata?: Record<string, unknown> | null;
  concepts?: unknown;
  attached_files?: unknown;
};

interface InvoicesContextValue {
  invoices: Invoice[];
  loadInvoices: () => Promise<void>;
  addInvoice: (payload: InvoicePayload) => Promise<Invoice | null>;
  updateInvoice: (id: number, payload: InvoicePayload) => Promise<boolean>;
  voidInvoice: (id: number, reason?: string | null) => Promise<boolean>;
}

const defaultContext: InvoicesContextValue = {
  invoices: [],
  loadInvoices: async () => {},
  addInvoice: async () => null,
  updateInvoice: async () => false,
  voidInvoice: async () => false,
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

const parseConcepts = (value: unknown): InvoiceConcept[] => {
  const ensureConcept = (input: unknown): InvoiceConcept => {
    if (!input || typeof input !== 'object') {
      return {};
    }

    const concept = input as Record<string, unknown>;
    return {
      id: toNullableNumber(concept.id ?? concept.concept_id ?? concept.identifier ?? null) ?? undefined,
      concept_code: typeof concept.concept_code === 'string'
        ? concept.concept_code
        : typeof concept.code === 'string'
        ? concept.code
        : null,
      description: typeof concept.description === 'string' ? concept.description : null,
      quantity: toNullableNumber(concept.quantity ?? concept.qty ?? null),
      unit_price: toNullableNumber(concept.unit_price ?? concept.price ?? concept.amount ?? null),
      job_id: toNullableNumber(concept.job_id ?? concept.related_job_id ?? null),
      metadata:
        concept.metadata && typeof concept.metadata === 'object' ? (concept.metadata as Record<string, unknown>) : null,
    };
  };

  if (Array.isArray(value)) {
    return value.map(item => ensureConcept(item));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ensureConcept(item));
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
    return record.items.map(item => ensureConcept(item));
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

const parseInvoice = (raw: Record<string, unknown>): Invoice => {
  const jobIds = parseJobIds(
    raw.job_ids ?? raw.jobs ?? raw.related_jobs ?? raw.job_references ?? raw.linked_jobs ?? [],
  );
  const concepts = parseConcepts(raw.concepts ?? raw.items ?? raw.lines ?? []);

  return {
    id: toNumber(raw.id ?? raw.invoice_id ?? raw.identifier ?? 0),
    status:
      typeof raw.status === 'string'
        ? (raw.status as InvoiceStatus)
        : typeof raw.invoice_status === 'string'
        ? (raw.invoice_status as InvoiceStatus)
        : 'draft',
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
    metadata:
      raw.metadata && typeof raw.metadata === 'object'
        ? (raw.metadata as Record<string, unknown>)
        : raw.meta && typeof raw.meta === 'object'
        ? (raw.meta as Record<string, unknown>)
        : null,
    concepts,
    attached_files: parseAttachedFiles(raw.attached_files ?? raw.attachments ?? null),
  };
};

const getInvoiceSortValue = (invoice: Invoice): SortableDate => {
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

const sanitizeConceptForPayload = (concept: InvoiceConcept | Record<string, unknown>): Record<string, unknown> => {
  const raw = concept as Record<string, unknown>;
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

  if ('total_amount' in normalized) {
    normalized.total_amount = toNullableNumber(normalized.total_amount ?? null);
  }

  if ('job_ids' in normalized) {
    const ids = parseJobIds(normalized.job_ids);
    normalized.job_ids = ids;
  }

  if ('concepts' in normalized) {
    const concepts = parseConcepts(normalized.concepts);
    normalized.concepts = concepts.map(item => sanitizeConceptForPayload(item));
  }

  if ('attached_files' in normalized) {
    normalized.attached_files = serializeAttachedFiles(
      parseAttachedFiles(normalized.attached_files as unknown),
    );
  }

  return normalized;
};

export const InvoicesProvider = ({ children }: { children: ReactNode }) => {
  const [invoices, setInvoices] = useCachedState<Invoice[]>('invoices', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setInvoices(prev => ensureSortedByNewest(prev, getInvoiceSortValue, invoice => invoice.id));
  }, [setInvoices]);

  const loadInvoices = useCallback(async () => {
    if (!token) {
      setInvoices([]);
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
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar facturas, se solicitará uno nuevo.');
        return;
      }
      console.error('Error loading invoices:', error);
    }
  }, [setInvoices, token]);

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
        const data = await response.json();

        const createdRaw: Record<string, unknown> | null = (() => {
          if (data && typeof data === 'object') {
            if ('invoice' in data && data.invoice) {
              return data.invoice as Record<string, unknown>;
            }
            if ('data' in data && data.data && typeof data.data === 'object') {
              return data.data as Record<string, unknown>;
            }
            if ('invoice_id' in data) {
              return { ...body, id: (data as any).invoice_id } as Record<string, unknown>;
            }
            if ('id' in data) {
              return { ...body, id: (data as any).id } as Record<string, unknown>;
            }
          }
          return null;
        })();

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

        await loadInvoices();
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
        const data = await response.json();

        const updatedRaw: Record<string, unknown> | null = (() => {
          if (data && typeof data === 'object') {
            if ('invoice' in data && data.invoice) {
              return data.invoice as Record<string, unknown>;
            }
            if ('data' in data && data.data && typeof data.data === 'object') {
              return data.data as Record<string, unknown>;
            }
            if ('message' in data) {
              return { ...body, id } as Record<string, unknown>;
            }
          }
          return null;
        })();

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

        await loadInvoices();
        return true;
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
        const data = await response.json();

        if (data && typeof data === 'object') {
          const raw: Record<string, unknown> | null = (() => {
            if ('invoice' in data && data.invoice) {
              return data.invoice as Record<string, unknown>;
            }
            if ('data' in data && data.data && typeof data.data === 'object') {
              return data.data as Record<string, unknown>;
            }
            return { id, status: 'void', voided_at: new Date().toISOString() };
          })();

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

  useEffect(() => {
    if (token) {
      void loadInvoices();
    }
  }, [loadInvoices, token]);

  return (
    <InvoicesContext.Provider value={{ invoices, loadInvoices, addInvoice, updateInvoice, voidInvoice }}>
      {children}
    </InvoicesContext.Provider>
  );
};
