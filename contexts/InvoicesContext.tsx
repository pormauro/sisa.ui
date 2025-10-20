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
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';
import { AfipEvent, parseAfipEventsCollection, parseAfipResponsePayload } from '@/types/afip';

export type InvoiceStatus = 'pending' | 'paid' | 'cancelled' | string;

export interface AfipInvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount?: number;
  total_amount?: number;
  measure_unit?: string | null;
}

export interface AfipVatBreakdownEntry {
  id?: number;
  vat_rate: number;
  taxable_amount: number;
  vat_amount: number;
  total_amount?: number;
}

export interface AfipTributeEntry {
  id?: number;
  type?: string | number | null;
  description?: string | null;
  amount: number;
  base_amount?: number;
  tax_id?: string | number | null;
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
  afip_point_of_sale_id?: number | null;
  afip_voucher_type?: string | number | null;
  concept?: number | null;
  customer_document_type?: string | number | null;
  customer_document_number?: string | null;
  vat_breakdown?: AfipVatBreakdownEntry[] | null;
  tributes?: AfipTributeEntry[] | null;
  currency?: string | null;
  exchange_rate?: number | null;
  cae?: string | null;
  cae_due_date?: string | null;
  afip_response_payload?: unknown;
  afip_events?: AfipEvent[] | null;
  items?: AfipInvoiceItem[] | null;
  [key: string]: unknown;
}

export interface CreateAfipInvoicePayload {
  client_id: number;
  afip_point_of_sale_id: number | null;
  afip_voucher_type: string | number;
  concept: number;
  items: (AfipInvoiceItem | (AfipInvoiceItem & { [key: string]: unknown }))[];
  vat_breakdown?: (AfipVatBreakdownEntry | (AfipVatBreakdownEntry & { [key: string]: unknown }))[];
  tributes?: (AfipTributeEntry | (AfipTributeEntry & { [key: string]: unknown }))[];
  customer_document_type?: string | number | null;
  customer_document_number?: string | null;
  currency?: string | null;
  exchange_rate?: number | null;
  issue_date?: string | null;
  due_date?: string | null;
  observations?: string | null;
  status?: InvoiceStatus | null;
}

export interface SubmitAfipInvoicePayload extends CreateAfipInvoicePayload {
  id?: number;
}

export interface AnnulInvoicePayload {
  reason?: string | null;
  observations?: string | null;
}

interface InvoicesContextValue {
  invoices: Invoice[];
  loadInvoices: () => Promise<void>;
  updateInvoiceStatus: (id: number, status: InvoiceStatus) => Promise<boolean>;
  refreshInvoice: (id: number) => Promise<Invoice | null>;
  createInvoice: (payload: CreateAfipInvoicePayload) => Promise<Invoice | null>;
  submitAfipInvoice: (id: number, payload: SubmitAfipInvoicePayload) => Promise<Invoice | null>;
  annulInvoice: (id: number, payload?: AnnulInvoicePayload) => Promise<boolean>;
  reprintInvoice: (id: number) => Promise<boolean>;
}

const noop = async () => {};

const INVOICE_ENDPOINT_CANDIDATES = ['/invoices', '/billing/invoices'];

export const InvoicesContext = createContext<InvoicesContextValue>({
  invoices: [],
  loadInvoices: noop,
  updateInvoiceStatus: async () => false,
  refreshInvoice: async () => null,
  createInvoice: async () => null,
  submitAfipInvoice: async () => null,
  annulInvoice: async () => false,
  reprintInvoice: async () => false,
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

  const parseNumeric = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const parseVatBreakdown = (value: unknown): AfipVatBreakdownEntry[] | undefined => {
    if (!value) {
      return undefined;
    }
    const normaliseEntry = (entry: unknown): AfipVatBreakdownEntry | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const item = entry as Record<string, unknown>;
      const vatRate = parseNumeric(item['vat_rate'] ?? item['aliquot_id'] ?? item['rate']);
      const taxable = parseNumeric(item['taxable_amount'] ?? item['net_amount']);
      const vatAmount = parseNumeric(item['vat_amount'] ?? item['tax_amount']);
      if (
        vatRate === undefined ||
        taxable === undefined ||
        vatAmount === undefined
      ) {
        return null;
      }
      const total = parseNumeric(item['total_amount'] ?? taxable + vatAmount);
      const idValue = item['id'];
      const id = typeof idValue === 'number' ? idValue : parseNumeric(idValue);
      return {
        id: typeof id === 'number' ? id : undefined,
        vat_rate: vatRate,
        taxable_amount: taxable,
        vat_amount: vatAmount,
        total_amount: total,
      };
    };

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map(normaliseEntry).filter((entry): entry is AfipVatBreakdownEntry => Boolean(entry));
        }
      } catch (error) {
        console.warn('No se pudo parsear vat_breakdown:', error);
        return undefined;
      }
    }

    if (Array.isArray(value)) {
      return value.map(normaliseEntry).filter((entry): entry is AfipVatBreakdownEntry => Boolean(entry));
    }

    if (typeof value === 'object') {
      const entries = Object.values(value as Record<string, unknown>);
      return entries.map(normaliseEntry).filter((entry): entry is AfipVatBreakdownEntry => Boolean(entry));
    }

    return undefined;
  };

  const parseTributes = (value: unknown): AfipTributeEntry[] | undefined => {
    if (!value) {
      return undefined;
    }
    const normaliseTribute = (entry: unknown): AfipTributeEntry | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const recordEntry = entry as Record<string, unknown>;
      const amount = parseNumeric(recordEntry['amount'] ?? recordEntry['tax_amount']);
      if (amount === undefined) {
        return null;
      }
      const baseAmount = parseNumeric(recordEntry['base_amount'] ?? recordEntry['base']);
      const idValue = recordEntry['id'];
      const id = typeof idValue === 'number' ? idValue : parseNumeric(idValue);
      return {
        id: typeof id === 'number' ? id : undefined,
        type: recordEntry['type'] ?? recordEntry['tribute_type'] ?? recordEntry['code'] ?? null,
        description: typeof recordEntry['description'] === 'string'
          ? recordEntry['description']
          : typeof recordEntry['name'] === 'string'
            ? recordEntry['name']
            : null,
        amount,
        base_amount: baseAmount,
        tax_id: recordEntry['tax_id'] ?? recordEntry['taxId'] ?? null,
      };
    };

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map(normaliseTribute).filter((entry): entry is AfipTributeEntry => Boolean(entry));
        }
      } catch (error) {
        console.warn('No se pudo parsear tributes:', error);
        return undefined;
      }
    }

    if (Array.isArray(value)) {
      return value.map(normaliseTribute).filter((entry): entry is AfipTributeEntry => Boolean(entry));
    }

    if (typeof value === 'object') {
      const entries = Object.values(value as Record<string, unknown>);
      return entries.map(normaliseTribute).filter((entry): entry is AfipTributeEntry => Boolean(entry));
    }

    return undefined;
  };

  const parseItems = (value: unknown): AfipInvoiceItem[] | undefined => {
    if (!value) {
      return undefined;
    }
    const normaliseItem = (entry: unknown): AfipInvoiceItem | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const recordEntry = entry as Record<string, unknown>;
      const quantity = parseNumeric(recordEntry['quantity']);
      const unitPrice = parseNumeric(recordEntry['unit_price'] ?? recordEntry['unitPrice'] ?? recordEntry['price']);
      const vatRate = parseNumeric(recordEntry['vat_rate'] ?? recordEntry['rate'] ?? recordEntry['aliquot']);
      if (quantity === undefined || unitPrice === undefined || vatRate === undefined) {
        return null;
      }
      const vatAmount = parseNumeric(recordEntry['vat_amount'] ?? recordEntry['iva_amount']);
      const totalAmount = parseNumeric(recordEntry['total_amount']);
      const idValue = recordEntry['id'];
      const id = typeof idValue === 'number' ? idValue : parseNumeric(idValue);
      return {
        id: typeof id === 'number' ? id : undefined,
        description:
          typeof recordEntry['description'] === 'string'
            ? recordEntry['description']
            : typeof recordEntry['name'] === 'string'
              ? recordEntry['name']
              : '',
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        measure_unit:
          typeof recordEntry['measure_unit'] === 'string'
            ? recordEntry['measure_unit']
            : typeof recordEntry['unit'] === 'string'
              ? recordEntry['unit']
              : null,
      };
    };

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map(normaliseItem).filter((entry): entry is AfipInvoiceItem => Boolean(entry));
        }
      } catch (error) {
        console.warn('No se pudo parsear items de factura:', error);
        return undefined;
      }
    }

    if (Array.isArray(value)) {
      return value.map(normaliseItem).filter((entry): entry is AfipInvoiceItem => Boolean(entry));
    }

    if (typeof value === 'object') {
      const entries = Object.values(value as Record<string, unknown>);
      return entries.map(normaliseItem).filter((entry): entry is AfipInvoiceItem => Boolean(entry));
    }

    return undefined;
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

  const vatBreakdown = parseVatBreakdown(record['vat_breakdown']);
  if (vatBreakdown) {
    normalised.vat_breakdown = vatBreakdown;
  }

  const tributes = parseTributes(record['tributes']);
  if (tributes) {
    normalised.tributes = tributes;
  }

  const items = parseItems(record['items']);
  if (items) {
    normalised.items = items;
  }

  const caeRaw = record['cae'] ?? record['CAE'] ?? record['cae_number'];
  if (typeof caeRaw === 'string') {
    const trimmed = caeRaw.trim();
    if (trimmed) {
      normalised.cae = trimmed;
    }
  } else if (typeof caeRaw === 'number') {
    normalised.cae = caeRaw.toString();
  }

  const caeDueRaw = record['cae_due_date'] ?? record['caeDueDate'] ?? record['cae_expiration'];
  if (typeof caeDueRaw === 'string' || typeof caeDueRaw === 'number') {
    const value = caeDueRaw === null ? null : String(caeDueRaw);
    if (value) {
      normalised.cae_due_date = value;
    }
  }

  const responsePayload = parseAfipResponsePayload(
    record['afip_response_payload'] ?? record['afip_response'] ?? record['response_payload']
  );
  if (responsePayload !== undefined) {
    normalised.afip_response_payload = responsePayload;
  }

  const events = parseAfipEventsCollection(
    record['afip_events'] ?? record['events'] ?? record['afip_event_logs'] ?? record['event_history']
  );
  if (events.length > 0) {
    normalised.afip_events = events;
  } else if ('afip_events' in record || 'events' in record) {
    normalised.afip_events = [];
  }

  const exchangeRate = parseNumeric(record['exchange_rate'] ?? record['exchangeRate']);
  if (typeof exchangeRate === 'number') {
    normalised.exchange_rate = exchangeRate;
  }

  return normalised;
};

type ExtendedHttpError = Error & {
  status?: number;
  payload?: unknown;
  responseText?: string;
  path?: string;
};

const parseAfipErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const messages: string[] = [];
  const hasExplicitErrors =
    Boolean(record['afip_errors']) ||
    Boolean(record['afip_error']) ||
    Boolean(record['errors']) ||
    String(record['status'] ?? record['result'] ?? '').toLowerCase() === 'error' ||
    String(record['success'] ?? '').toLowerCase() === 'false';

  const pushValue = (value: unknown) => {
    if (!value) {
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        messages.push(trimmed);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => pushValue(item));
      return;
    }
    if (typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (typeof nested['message'] === 'string') {
        pushValue(nested['message']);
      }
      if (typeof nested['detail'] === 'string') {
        pushValue(nested['detail']);
      }
      if (typeof nested['error'] === 'string') {
        pushValue(nested['error']);
      }
      const other = ['code', 'cae_result'];
      other.forEach(key => {
        if (typeof nested[key] === 'string') {
          pushValue(nested[key]);
        }
      });
      const messageValues = Object.values(nested).filter(value => typeof value === 'string');
      if (messageValues.length === 0) {
        Object.values(nested).forEach(value => pushValue(value));
      }
      return;
    }
  };

  pushValue(record['afip_errors']);
  pushValue(record['afip_error']);
  pushValue(record['errors']);
  pushValue(record['error']);
  if (hasExplicitErrors) {
    pushValue(record['message']);
  }
  pushValue(record['detail']);

  if (messages.length > 0) {
    return Array.from(new Set(messages)).join('\n');
  }

  return null;
};

const mapAfipError = (error: unknown): Error => {
  if (error instanceof Error) {
    const extended = error as ExtendedHttpError;
    const messageFromPayload = extended.payload ? parseAfipErrorMessage(extended.payload) : null;
    if (messageFromPayload) {
      return new Error(messageFromPayload);
    }
    if (extended.responseText) {
      try {
        const parsedJson = JSON.parse(extended.responseText);
        const parsed = parseAfipErrorMessage(parsedJson);
        if (parsed) {
          return new Error(parsed);
        }
      } catch {
        const trimmed = extended.responseText.trim();
        if (trimmed) {
          return new Error(trimmed);
        }
      }
    }
    return error;
  }
  return new Error('Se produjo un error al comunicarse con AFIP.');
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normaliseAfipInvoicePayload = (payload: CreateAfipInvoicePayload | SubmitAfipInvoicePayload) => {
  const normalisedItems = (payload.items ?? [])
    .map(item => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unit_price);
      const vatRate = toNumber(item.vat_rate);
      if (quantity === null || unitPrice === null || vatRate === null) {
        return null;
      }
      const net = quantity * unitPrice;
      const vatAmount =
        item.vat_amount !== undefined && item.vat_amount !== null
          ? toNumber(item.vat_amount) ?? Number((net * (vatRate / 100)).toFixed(2))
          : Number((net * (vatRate / 100)).toFixed(2));
      const totalAmount =
        item.total_amount !== undefined && item.total_amount !== null
          ? toNumber(item.total_amount) ?? Number(((vatAmount ?? 0) + net).toFixed(2))
          : Number(((vatAmount ?? 0) + net).toFixed(2));
      return {
        ...(item.id ? { id: item.id } : {}),
        description: item.description,
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        ...(typeof vatAmount === 'number' ? { vat_amount: Number(vatAmount.toFixed(2)) } : {}),
        ...(typeof totalAmount === 'number' ? { total_amount: Number(totalAmount.toFixed(2)) } : {}),
        ...(item.measure_unit ? { measure_unit: item.measure_unit } : {}),
      };
    })
    .filter((item): item is AfipInvoiceItem => Boolean(item));

  const normalisedVat = (payload.vat_breakdown ?? [])
    .map(entry => {
      const vatRate = toNumber(entry.vat_rate);
      const taxable = toNumber(entry.taxable_amount);
      const vatAmount = toNumber(entry.vat_amount);
      if (vatRate === null || taxable === null || vatAmount === null) {
        return null;
      }
      const total =
        entry.total_amount !== undefined && entry.total_amount !== null
          ? toNumber(entry.total_amount)
          : Number((taxable + vatAmount).toFixed(2));
      return {
        ...(entry.id ? { id: entry.id } : {}),
        vat_rate: vatRate,
        taxable_amount: Number(taxable.toFixed(2)),
        vat_amount: Number(vatAmount.toFixed(2)),
        ...(typeof total === 'number' ? { total_amount: Number(total.toFixed(2)) } : {}),
      };
    })
    .filter((entry): entry is AfipVatBreakdownEntry => Boolean(entry));

  const normalisedTributes = (payload.tributes ?? [])
    .map(entry => {
      const amount = toNumber(entry.amount);
      if (amount === null) {
        return null;
      }
      const baseAmount = entry.base_amount !== undefined && entry.base_amount !== null ? toNumber(entry.base_amount) : null;
      return {
        ...(entry.id ? { id: entry.id } : {}),
        ...(entry.type ? { type: entry.type } : {}),
        ...(entry.description ? { description: entry.description } : {}),
        amount: Number(amount.toFixed(2)),
        ...(baseAmount !== null ? { base_amount: Number(baseAmount.toFixed(2)) } : {}),
        ...(entry.tax_id ? { tax_id: entry.tax_id } : {}),
      };
    })
    .filter((entry): entry is AfipTributeEntry => Boolean(entry));

  const currency = payload.currency ? String(payload.currency).toUpperCase().trim() : undefined;
  const exchangeRate = payload.exchange_rate !== undefined && payload.exchange_rate !== null
    ? toNumber(payload.exchange_rate)
    : null;

  const rawPointOfSaleId = payload.afip_point_of_sale_id;
  const normalisedPointOfSaleId =
    rawPointOfSaleId === null ? null : toNumber(rawPointOfSaleId);

  return {
    client_id: payload.client_id,
    afip_point_of_sale_id: normalisedPointOfSaleId === null ? null : normalisedPointOfSaleId,
    afip_voucher_type: payload.afip_voucher_type,
    concept: payload.concept,
    items: normalisedItems,
    ...(normalisedVat.length > 0 ? { vat_breakdown: normalisedVat } : {}),
    ...(normalisedTributes.length > 0 ? { tributes: normalisedTributes } : {}),
    ...(payload.customer_document_type
      ? { customer_document_type: payload.customer_document_type }
      : {}),
    ...(payload.customer_document_number
      ? { customer_document_number: payload.customer_document_number }
      : {}),
    ...(currency ? { currency } : {}),
    ...(exchangeRate !== null ? { exchange_rate: Number(exchangeRate.toFixed(6)) } : {}),
    ...(payload.issue_date ? { issue_date: payload.issue_date } : {}),
    ...(payload.due_date ? { due_date: payload.due_date } : {}),
    ...(payload.observations ? { observations: payload.observations } : {}),
    ...(payload.status ? { status: payload.status } : {}),
  };
};

const extractInvoiceFromPayload = (payload: unknown): Invoice | null => {
  if (!payload) {
    return null;
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (record['afip_invoice']) {
      const parsed = toInvoice(record['afip_invoice']);
      if (parsed) {
        return parsed;
      }
    }
    if (record['afipInvoice']) {
      const parsed = toInvoice(record['afipInvoice']);
      if (parsed) {
        return parsed;
      }
    }
    if (record['invoice']) {
      const parsed = toInvoice(record['invoice']);
      if (parsed) {
        return parsed;
      }
    }
    if (record['data']) {
      const parsed = toInvoice(record['data']);
      if (parsed) {
        return parsed;
      }
    }
  }
  return toInvoice(payload);
};

export const InvoicesProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const [invoices, setInvoices] = useCachedState<Invoice[]>('invoices', []);
  const invoicesRef = useRef(invoices);
  const resolvedEndpointRef = useRef<string | null>(null);

  const canListInvoices = permissions.includes('listInvoices');
  const canViewInvoices = permissions.includes('viewInvoice');
  const canUpdateInvoiceStatus =
    permissions.includes('updateInvoice') ||
    permissions.includes('createInvoice') ||
    permissions.includes('submitAfipInvoice');
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
          let payload: unknown = null;
          try {
            const clone = response.clone();
            payload = await clone.json();
          } catch {
            payload = null;
          }

          let responseText = '';
          try {
            responseText = await response.text();
          } catch {
            responseText = '';
          }

          const error = new Error(
            `HTTP ${response.status} ${buildPath(basePath)} ${responseText ?? ''}`
          ) as ExtendedHttpError;
          error.status = response.status;
          error.payload = payload;
          error.responseText = responseText;
          error.path = buildPath(basePath);
          throw error;
        }

        resolvedEndpointRef.current = basePath;
        return response;
      }

      const detail = last404Path ? `${last404Status} en ${last404Path}` : 'sin respuesta válida';
      throw new Error(`No se pudo resolver el endpoint de facturas (${detail}).`);
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

      setInvoices(sortByNewest(list, getDefaultSortValue));
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }, [canListInvoices, performInvoiceRequest, setInvoices, token]);

  const refreshInvoice = useCallback(
    async (id: number): Promise<Invoice | null> => {
      if (!token || !canAccessInvoices) {
        return null;
      }

      try {
        const response = await performInvoiceRequest(basePath => `${basePath}/${id}`);
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
    [canAccessInvoices, performInvoiceRequest, setInvoices, token]
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

  const createInvoice = useCallback(
    async (payload: CreateAfipInvoicePayload): Promise<Invoice | null> => {
      if (!token) {
        throw new Error('Token no disponible para crear facturas AFIP');
      }

      try {
        const response = await performInvoiceRequest(
          () => '/afip/invoices',
          {
            method: 'POST',
            body: JSON.stringify(normaliseAfipInvoicePayload(payload)),
          }
        );

        const data = await response.json().catch(() => ({}));
        const errorMessage = parseAfipErrorMessage(data);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        const invoice = extractInvoiceFromPayload(data);
        if (invoice) {
          setInvoices(prev =>
            ensureSortedByNewest(
              [invoice, ...prev.filter(item => item.id !== invoice.id)],
              getDefaultSortValue
            )
          );
          return invoice;
        }

        return null;
      } catch (error) {
        const mapped = mapAfipError(error);
        console.error('Error creating AFIP invoice:', mapped);
        throw mapped;
      }
    },
    [performInvoiceRequest, setInvoices, token]
  );

  const submitAfipInvoice = useCallback(
    async (
      id: number,
      payload: SubmitAfipInvoicePayload
    ): Promise<Invoice | null> => {
      if (!token) {
        throw new Error('Token no disponible para enviar factura AFIP');
      }

      try {
        const response = await performInvoiceRequest(
          () => `/afip/invoices/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(normaliseAfipInvoicePayload({ ...payload, id })),
          }
        );

        const data = await response.json().catch(() => ({}));
        const errorMessage = parseAfipErrorMessage(data);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        const invoice = extractInvoiceFromPayload(data);
        if (invoice) {
          setInvoices(prev =>
            ensureSortedByNewest(
              prev.map(item => (item.id === invoice.id ? { ...item, ...invoice } : item)),
              getDefaultSortValue
            )
          );
          return invoice;
        }

        return null;
      } catch (error) {
        const mapped = mapAfipError(error);
        console.error('Error submitting AFIP invoice:', mapped);
        throw mapped;
      }
    },
    [performInvoiceRequest, setInvoices, token]
  );

  const reprintInvoice = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) {
        throw new Error('Token no disponible para reimprimir factura AFIP');
      }

      try {
        const response = await performInvoiceRequest(
          () => `/afip/invoices/${id}/reprint`,
          { method: 'POST' }
        );

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const data = await response.json().catch(() => ({}));
          const errorMessage = parseAfipErrorMessage(data);
          if (errorMessage) {
            throw new Error(errorMessage);
          }

          const invoice = extractInvoiceFromPayload(data);
          if (invoice) {
            setInvoices(prev =>
              ensureSortedByNewest(
                prev.map(item => (item.id === invoice.id ? { ...item, ...invoice } : item)),
                getDefaultSortValue
              )
            );
          }
        }

        return true;
      } catch (error) {
        const mapped = mapAfipError(error);
        console.error('Error requesting invoice reprint:', mapped);
        throw mapped;
      }
    },
    [performInvoiceRequest, setInvoices, token]
  );

  const annulInvoice = useCallback(
    async (id: number, payload?: AnnulInvoicePayload): Promise<boolean> => {
      if (!token) {
        throw new Error('Token no disponible para anular factura AFIP');
      }

      try {
        const requestInit: RequestInit = { method: 'DELETE' };
        if (payload && (payload.reason || payload.observations)) {
          requestInit.body = JSON.stringify(payload);
        }

        const response = await performInvoiceRequest(
          () => `/afip/invoices/${id}`,
          requestInit
        );

        if (response.status === 204) {
          setInvoices(prev =>
            ensureSortedByNewest(
              prev.map(item => (item.id === id ? { ...item, status: 'cancelled' } : item)),
              getDefaultSortValue
            )
          );
          return true;
        }

        const data = await response.json().catch(() => ({}));
        const errorMessage = parseAfipErrorMessage(data);
        if (errorMessage) {
          throw new Error(errorMessage);
        }

        const invoice = extractInvoiceFromPayload(data);
        if (invoice) {
          setInvoices(prev =>
            ensureSortedByNewest(
              prev.map(item => (item.id === invoice.id ? { ...item, ...invoice } : item)),
              getDefaultSortValue
            )
          );
        } else {
          setInvoices(prev =>
            ensureSortedByNewest(
              prev.map(item => (item.id === id ? { ...item, status: 'cancelled' } : item)),
              getDefaultSortValue
            )
          );
        }

        return true;
      } catch (error) {
        const mapped = mapAfipError(error);
        console.error('Error annulling AFIP invoice:', mapped);
        throw mapped;
      }
    },
    [performInvoiceRequest, setInvoices, token]
  );

  useEffect(() => {
    if (token && canListInvoices) {
      void loadInvoices();
    }
  }, [canListInvoices, loadInvoices, token]);

  const contextValue = useMemo(
    () => ({
      invoices,
      loadInvoices,
      updateInvoiceStatus,
      refreshInvoice,
      createInvoice,
      submitAfipInvoice,
      annulInvoice,
      reprintInvoice,
    }),
    [
      annulInvoice,
      createInvoice,
      invoices,
      loadInvoices,
      refreshInvoice,
      reprintInvoice,
      submitAfipInvoice,
      updateInvoiceStatus,
    ]
  );

  return <InvoicesContext.Provider value={contextValue}>{children}</InvoicesContext.Provider>;
};
