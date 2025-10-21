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

export type InvoiceStatus = 'issued' | 'paid' | 'cancelled' | string;

export interface AfipInvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount?: number;
  total_amount?: number;
  measure_unit?: string | null;
  afip_iva_id?: number | null;
}

export interface AfipVatBreakdownEntry {
  id?: number;
  vat_rate: number;
  taxable_amount: number;
  vat_amount: number;
  total_amount?: number;
  afip_iva_id?: number | null;
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
  afip_account_id?: number | null;
  emisor_empresa_id?: number | null;
  afip_tipo_comprobante_id?: number | string | null;
  afip_moneda_id?: number | string | null;
  pto_vta?: number | string | null;
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

const INVOICE_ENDPOINT_CANDIDATES = ['/comprobantes', '/invoices', '/billing/invoices'];

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
    record['imp_total'],
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

  if (normalised.total !== undefined && normalised.total !== null) {
    normalised.total_amount = normalised.total;
  }

  const netAmount = parseNumeric(record['imp_neto_gravado']);
  if (typeof netAmount === 'number') {
    normalised.subtotal = netAmount;
    if (normalised.amount === undefined || normalised.amount === null) {
      normalised.amount = netAmount;
    }
  }

  const vatAmount = parseNumeric(record['imp_iva']);
  if (typeof vatAmount === 'number') {
    normalised.vat_amount = vatAmount;
  }

  const possibleStatuses = [record['status'], record['state'], record['invoice_status'], record['estado']];
  for (const value of possibleStatuses) {
    if (typeof value === 'string' && value.trim()) {
      normalised.status = value as InvoiceStatus;
      break;
    }
  }

  if (!normalised.status) {
    normalised.status = 'issued';
  }

  const currency = parseString(record['currency'] ?? record['afip_moneda_id']);
  if (currency) {
    normalised.currency = currency;
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

  const caeDueRaw =
    record['cae_due_date'] ?? record['caeDueDate'] ?? record['cae_expiration'] ?? record['cae_vencimiento'];
  if (typeof caeDueRaw === 'string' || typeof caeDueRaw === 'number') {
    const value = caeDueRaw === null ? null : String(caeDueRaw);
    if (value) {
      normalised.cae_due_date = value;
    }
  }

  const issueDateCandidates = [record['issue_date'], record['issued_at'], record['fecha_emision']];
  for (const candidate of issueDateCandidates) {
    const parsed = parseString(candidate);
    if (parsed) {
      normalised.issue_date = parsed;
      break;
    }
  }

  const dueDateCandidates = [record['due_date'], record['due_at'], record['fecha_vencimiento']];
  for (const candidate of dueDateCandidates) {
    const parsed = parseString(candidate);
    if (parsed) {
      normalised.due_date = parsed;
      break;
    }
  }

  const createdAtCandidates = [record['created_at'], record['creado_en']];
  for (const candidate of createdAtCandidates) {
    const parsed = parseString(candidate);
    if (parsed) {
      normalised.created_at = parsed;
      break;
    }
  }

  const updatedAtCandidates = [record['updated_at'], record['actualizado_en']];
  for (const candidate of updatedAtCandidates) {
    const parsed = parseString(candidate);
    if (parsed) {
      normalised.updated_at = parsed;
      break;
    }
  }

  const invoiceNumber = parseString(
    record['invoice_number'] ?? record['invoiceNumber'] ?? record['numero'] ?? record['comprobante']
  );
  if (invoiceNumber) {
    normalised.invoice_number = invoiceNumber;
    if (!normalised.number) {
      normalised.number = invoiceNumber;
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

  const exchangeRate = parseNumeric(record['exchange_rate'] ?? record['exchangeRate'] ?? record['cotizacion']);
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

type SerialisedAfipInvoicePayload = {
  supportsNewApi: boolean;
  comprobante: Record<string, unknown>;
  comprobanteItems: Record<string, unknown>[];
  comprobanteVatSummary: Record<string, unknown>[];
  tributes: AfipTributeEntry[];
  legacy: Record<string, unknown>;
};

const normaliseAfipInvoicePayload = (
  payload: CreateAfipInvoicePayload | SubmitAfipInvoicePayload
): SerialisedAfipInvoicePayload => {
  const normalisedItems = (payload.items ?? [])
    .map(item => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unit_price);
      const vatRate = toNumber(item.vat_rate);
      if (quantity === null || unitPrice === null || vatRate === null) {
        return null;
      }
      const net = quantity * unitPrice;
      const vatAmountRaw =
        item.vat_amount !== undefined && item.vat_amount !== null
          ? toNumber(item.vat_amount) ?? Number((net * (vatRate / 100)).toFixed(2))
          : Number((net * (vatRate / 100)).toFixed(2));
      const vatAmount = typeof vatAmountRaw === 'number' ? Number(vatAmountRaw.toFixed(2)) : Number((net * (vatRate / 100)).toFixed(2));
      const totalAmountRaw =
        item.total_amount !== undefined && item.total_amount !== null
          ? toNumber(item.total_amount) ?? Number((vatAmount + net).toFixed(2))
          : Number((vatAmount + net).toFixed(2));
      const totalAmount = typeof totalAmountRaw === 'number' ? Number(totalAmountRaw.toFixed(2)) : Number((vatAmount + net).toFixed(2));
      const vatId =
        item.afip_iva_id !== undefined && item.afip_iva_id !== null
          ? toNumber(item.afip_iva_id)
          : vatRate;
      return {
        ...(item.id ? { id: item.id } : {}),
        description: item.description,
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        ...(typeof vatId === 'number' && Number.isFinite(vatId) ? { afip_iva_id: vatId } : {}),
        vat_amount: vatAmount,
        total_amount: totalAmount,
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
      const vatId =
        entry.afip_iva_id !== undefined && entry.afip_iva_id !== null
          ? toNumber(entry.afip_iva_id)
          : vatRate;
      return {
        ...(entry.id ? { id: entry.id } : {}),
        vat_rate: vatRate,
        taxable_amount: Number(taxable.toFixed(2)),
        vat_amount: Number(vatAmount.toFixed(2)),
        ...(typeof total === 'number' ? { total_amount: Number(total.toFixed(2)) } : {}),
        ...(typeof vatId === 'number' && Number.isFinite(vatId) ? { afip_iva_id: vatId } : {}),
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
  const exchangeRateValue =
    payload.exchange_rate !== undefined && payload.exchange_rate !== null ? toNumber(payload.exchange_rate) : null;
  const exchangeRate =
    exchangeRateValue !== null && Number.isFinite(exchangeRateValue) ? Number(exchangeRateValue.toFixed(6)) : 1;

  const rawPointOfSaleId = payload.afip_point_of_sale_id;
  const normalisedPointOfSaleId = rawPointOfSaleId === null ? null : toNumber(rawPointOfSaleId);

  const voucherTypeIdRaw =
    payload.afip_tipo_comprobante_id !== undefined && payload.afip_tipo_comprobante_id !== null
      ? toNumber(payload.afip_tipo_comprobante_id)
      : toNumber(payload.afip_voucher_type);
  const voucherTypeId = voucherTypeIdRaw !== null && Number.isFinite(voucherTypeIdRaw) ? voucherTypeIdRaw : null;

  const currencyIdRaw =
    payload.afip_moneda_id !== undefined && payload.afip_moneda_id !== null ? toNumber(payload.afip_moneda_id) : null;
  const currencyId = currencyIdRaw !== null && Number.isFinite(currencyIdRaw) ? currencyIdRaw : null;

  const pointOfSaleNumberRaw =
    payload.pto_vta !== undefined && payload.pto_vta !== null ? toNumber(payload.pto_vta) : null;
  const pointOfSaleNumber =
    pointOfSaleNumberRaw !== null && Number.isFinite(pointOfSaleNumberRaw) ? pointOfSaleNumberRaw : null;

  const netAmount = normalisedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmountTotal = normalisedItems.reduce((sum, item) => sum + (item.vat_amount ?? 0), 0);
  const tributesTotal = normalisedTributes.reduce((sum, entry) => sum + entry.amount, 0);
  const grandTotal = Number((netAmount + vatAmountTotal + tributesTotal).toFixed(2));

  const emissionDate = payload.issue_date && payload.issue_date.trim() ? payload.issue_date.trim() : new Date().toISOString().slice(0, 10);

  const comprobantePayload: Record<string, unknown> = {
    receptor_empresa_id: payload.client_id,
    concepto: payload.concept,
    fecha_emision: emissionDate,
    cotizacion: exchangeRate,
    imp_total: grandTotal,
    imp_neto: Number(netAmount.toFixed(2)),
    imp_iva: Number(vatAmountTotal.toFixed(2)),
    ...(tributesTotal > 0 ? { imp_trib: Number(tributesTotal.toFixed(2)) } : {}),
    ...(voucherTypeId !== null ? { afip_tipo_comprobante_id: voucherTypeId } : {}),
    ...(payload.due_date ? { fecha_vencimiento: payload.due_date } : {}),
    ...(currencyId !== null ? { afip_moneda_id: currencyId } : {}),
    ...(currency && currencyId === null ? { afip_moneda: currency } : {}),
    ...(payload.afip_account_id !== undefined && payload.afip_account_id !== null
      ? { afip_account_id: payload.afip_account_id }
      : {}),
    ...(payload.emisor_empresa_id !== undefined && payload.emisor_empresa_id !== null
      ? { emisor_empresa_id: payload.emisor_empresa_id }
      : {}),
    ...(normalisedPointOfSaleId !== null ? { afip_punto_de_venta_id: normalisedPointOfSaleId } : {}),
    ...(pointOfSaleNumber !== null ? { pto_vta: pointOfSaleNumber } : {}),
    ...(payload.customer_document_type ? { receptor_doc_tipo: payload.customer_document_type } : {}),
    ...(payload.customer_document_number ? { receptor_doc_nro: payload.customer_document_number } : {}),
    ...(payload.observations ? { observaciones: payload.observations } : {}),
    ...(payload.status ? { estado: payload.status } : {}),
    ...(currency ? { moneda: currency } : {}),
  };

  const comprobanteItems = normalisedItems.map(item => {
    const vatId = item.afip_iva_id ?? item.vat_rate;
    const resolvedVatId = vatId !== null && vatId !== undefined ? toNumber(vatId) : null;
    const baseAmount = Number((item.quantity * item.unit_price).toFixed(2));
    const vatAmount = Number((item.vat_amount ?? 0).toFixed(2));
    const subtotal = Number((item.total_amount ?? baseAmount + vatAmount).toFixed(2));
    return {
      descripcion: item.description,
      cantidad: item.quantity,
      precio_unitario: Number(item.unit_price.toFixed(2)),
      base_imponible: baseAmount,
      importe_iva: vatAmount,
      subtotal,
      ...(resolvedVatId !== null && Number.isFinite(resolvedVatId) ? { afip_iva_id: resolvedVatId } : {}),
    };
  });

  const comprobanteVatSummary = normalisedVat.map(entry => {
    const vatId = entry.afip_iva_id ?? entry.vat_rate;
    const resolvedVatId = vatId !== null && vatId !== undefined ? toNumber(vatId) : null;
    return {
      base_imponible: Number(entry.taxable_amount.toFixed(2)),
      importe: Number(entry.vat_amount.toFixed(2)),
      ...(entry.total_amount !== undefined ? { total: Number(entry.total_amount.toFixed(2)) } : {}),
      ...(resolvedVatId !== null && Number.isFinite(resolvedVatId) ? { afip_iva_id: resolvedVatId } : {}),
    };
  });

  const legacyPayload: Record<string, unknown> = {
    client_id: payload.client_id,
    afip_point_of_sale_id: normalisedPointOfSaleId === null ? null : normalisedPointOfSaleId,
    afip_voucher_type: payload.afip_voucher_type,
    concept: payload.concept,
    items: normalisedItems,
    ...(normalisedVat.length > 0 ? { vat_breakdown: normalisedVat } : {}),
    ...(normalisedTributes.length > 0 ? { tributes: normalisedTributes } : {}),
    ...(payload.customer_document_type ? { customer_document_type: payload.customer_document_type } : {}),
    ...(payload.customer_document_number ? { customer_document_number: payload.customer_document_number } : {}),
    ...(currency ? { currency } : {}),
    ...(exchangeRateValue !== null && Number.isFinite(exchangeRateValue)
      ? { exchange_rate: Number(exchangeRateValue.toFixed(6)) }
      : {}),
    ...(payload.issue_date ? { issue_date: payload.issue_date } : {}),
    ...(payload.due_date ? { due_date: payload.due_date } : {}),
    ...(payload.observations ? { observations: payload.observations } : {}),
    ...(payload.status ? { status: payload.status } : {}),
  };

  const supportsNewApi =
    typeof payload.afip_account_id === 'number' &&
    Number.isFinite(payload.afip_account_id) &&
    voucherTypeId !== null &&
    typeof payload.concept === 'number' &&
    Number.isFinite(payload.concept) &&
    typeof comprobantePayload.fecha_emision === 'string' &&
    comprobantePayload.fecha_emision.length > 0 &&
    currencyId !== null &&
    typeof comprobantePayload.cotizacion === 'number' &&
    Number.isFinite(comprobantePayload.cotizacion as number) &&
    typeof payload.emisor_empresa_id === 'number' &&
    Number.isFinite(payload.emisor_empresa_id) &&
    Number.isFinite(grandTotal) &&
    ((typeof normalisedPointOfSaleId === 'number' && Number.isFinite(normalisedPointOfSaleId)) ||
      (typeof pointOfSaleNumber === 'number' && Number.isFinite(pointOfSaleNumber)));

  return {
    supportsNewApi,
    comprobante: comprobantePayload,
    comprobanteItems,
    comprobanteVatSummary,
    tributes: normalisedTributes,
    legacy: legacyPayload,
  };
};

const shouldFallbackToLegacyEndpoint = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const status = (error as ExtendedHttpError).status;
  return typeof status === 'number' && [404, 405, 415, 501].includes(status);
};

const extractNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

const extractInvoiceIdentifier = (payload: unknown): number | null => {
  const parsed = extractInvoiceFromPayload(payload);
  if (parsed && typeof parsed.id === 'number' && Number.isFinite(parsed.id)) {
    return parsed.id;
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const nested = extractInvoiceIdentifier(entry);
      if (nested !== null) {
        return nested;
      }
    }
    return null;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const keys = [
      'id',
      'invoice_id',
      'invoiceId',
      'comprobante_id',
      'comprobanteId',
      'afip_invoice_id',
    ];
    for (const key of keys) {
      const candidate = extractNumericId(record[key]);
      if (candidate !== null) {
        return candidate;
      }
    }

    if ('data' in record) {
      const nested = extractInvoiceIdentifier(record['data']);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
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

  const submitComprobanteChildren = useCallback(
    async (
      comprobanteId: number,
      items: Record<string, unknown>[],
      vatSummary: Record<string, unknown>[]
    ) => {
      if (!token) {
        throw new Error('Token no disponible para detallar comprobantes');
      }

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const postEntry = async (path: string, body: Record<string, unknown>) => {
        const response = await fetch(`${BASE_URL}${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

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

          const error = new Error(`HTTP ${response.status} ${path}`) as ExtendedHttpError;
          error.status = response.status;
          error.payload = payload;
          error.responseText = responseText;
          error.path = path;
          throw error;
        }
      };

      for (const item of items) {
        await postEntry('/comprobantes-items', { ...item, comprobante_id: comprobanteId });
      }

      for (const entry of vatSummary) {
        await postEntry('/comprobantes-iva-resumen', { ...entry, comprobante_id: comprobanteId });
      }
    },
    [token]
  );

  const createInvoice = useCallback(
    async (payload: CreateAfipInvoicePayload): Promise<Invoice | null> => {
      if (!token) {
        throw new Error('Token no disponible para crear facturas AFIP');
      }

      const serialised = normaliseAfipInvoicePayload(payload);

      const executeLegacyRequest = async (): Promise<Invoice | null> => {
        const legacyResponse = await performInvoiceRequest(
          () => '/afip/invoices',
          {
            method: 'POST',
            body: JSON.stringify(serialised.legacy),
          }
        );

        const legacyData = await legacyResponse.json().catch(() => ({}));
        const legacyError = parseAfipErrorMessage(legacyData);
        if (legacyError) {
          throw new Error(legacyError);
        }

        const legacyInvoice = extractInvoiceFromPayload(legacyData);
        if (legacyInvoice) {
          setInvoices(prev =>
            ensureSortedByNewest(
              [legacyInvoice, ...prev.filter(item => item.id !== legacyInvoice.id)],
              getDefaultSortValue
            )
          );
          return legacyInvoice;
        }

        return null;
      };

      if (serialised.supportsNewApi) {
        try {
          const response = await performInvoiceRequest(
            basePath => `${basePath}`,
            {
              method: 'POST',
              body: JSON.stringify(serialised.comprobante),
            }
          );

          const data = await response.json().catch(() => ({}));
          const errorMessage = parseAfipErrorMessage(data);
          if (errorMessage) {
            throw new Error(errorMessage);
          }

          const invoice = extractInvoiceFromPayload(data);
          const invoiceId = invoice?.id ?? extractInvoiceIdentifier(data);

          if (invoiceId && (serialised.comprobanteItems.length > 0 || serialised.comprobanteVatSummary.length > 0)) {
            await submitComprobanteChildren(invoiceId, serialised.comprobanteItems, serialised.comprobanteVatSummary);
          }

          if (invoice) {
            setInvoices(prev =>
              ensureSortedByNewest(
                [invoice, ...prev.filter(item => item.id !== invoice.id)],
                getDefaultSortValue
              )
            );
            return invoice;
          }

          if (invoiceId) {
            const refreshed = await refreshInvoice(invoiceId);
            if (refreshed) {
              return refreshed;
            }
          }

          return null;
        } catch (error) {
          if (!shouldFallbackToLegacyEndpoint(error)) {
            const mapped = mapAfipError(error);
            console.error('Error creating AFIP invoice:', mapped);
            throw mapped;
          }
        }
      }

      try {
        return await executeLegacyRequest();
      } catch (error) {
        const mapped = mapAfipError(error);
        console.error('Error creating AFIP invoice:', mapped);
        throw mapped;
      }
    },
    [
      performInvoiceRequest,
      refreshInvoice,
      setInvoices,
      submitComprobanteChildren,
      token,
    ]
  );

  const submitAfipInvoice = useCallback(
    async (
      id: number,
      payload: SubmitAfipInvoicePayload
    ): Promise<Invoice | null> => {
      if (!token) {
        throw new Error('Token no disponible para enviar factura AFIP');
      }

      const serialised = normaliseAfipInvoicePayload({ ...payload, id });

      const executeLegacyRequest = async (): Promise<Invoice | null> => {
        const response = await performInvoiceRequest(
          () => `/afip/invoices/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(serialised.legacy),
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
      };

      if (serialised.supportsNewApi) {
        try {
          const response = await performInvoiceRequest(
            basePath => `${basePath}/${id}`,
            {
              method: 'PUT',
              body: JSON.stringify(serialised.comprobante),
            }
          );

          const data = await response.json().catch(() => ({}));
          const errorMessage = parseAfipErrorMessage(data);
          if (errorMessage) {
            throw new Error(errorMessage);
          }

          if (serialised.comprobanteItems.length > 0 || serialised.comprobanteVatSummary.length > 0) {
            try {
              await submitComprobanteChildren(id, serialised.comprobanteItems, serialised.comprobanteVatSummary);
            } catch (childError) {
              console.warn('No se pudo actualizar el detalle del comprobante AFIP.', childError);
            }
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
          if (!shouldFallbackToLegacyEndpoint(error)) {
            const mapped = mapAfipError(error);
            console.error('Error submitting AFIP invoice:', mapped);
            throw mapped;
          }
        }
      }

      try {
        return await executeLegacyRequest();
      } catch (error) {
        const mapped = mapAfipError(error);
        console.error('Error submitting AFIP invoice:', mapped);
        throw mapped;
      }
    },
    [performInvoiceRequest, setInvoices, submitComprobanteChildren, token]
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
