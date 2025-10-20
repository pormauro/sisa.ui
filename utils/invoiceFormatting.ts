const VOUCHER_LABELS: Record<string, string> = {
  '1': 'Factura A (01)',
  '3': 'Nota de Crédito A (03)',
  '6': 'Factura B (06)',
  '8': 'Nota de Crédito B (08)',
  '11': 'Factura C (11)',
  '13': 'Nota de Crédito C (13)',
};

const CONCEPT_LABELS: Record<number, string> = {
  1: 'Productos',
  2: 'Servicios',
  3: 'Productos y servicios',
};

const DOCUMENT_LABELS: Record<string, string> = {
  '80': 'CUIT (80)',
  '86': 'CUIL (86)',
  '96': 'DNI (96)',
  '94': 'Pasaporte (94)',
};

export const formatInvoiceDate = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    if (typeof value === 'string') {
      return value;
    }
    return '—';
  }
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatInvoiceDateTime = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    if (typeof value === 'string') {
      return value;
    }
    return '—';
  }
  return parsed.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatInvoiceCurrency = (value: unknown, currencyCode?: string | null): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  const resolvedCurrency = currencyCode && typeof currencyCode === 'string' && currencyCode.trim()
    ? currencyCode.trim().toUpperCase()
    : 'ARS';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: resolvedCurrency,
      minimumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return numeric.toFixed(2);
  }
};

export const formatVoucherType = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  const key = String(value);
  return VOUCHER_LABELS[key] ?? key;
};

export const formatConceptLabel = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && CONCEPT_LABELS[numeric]) {
    return CONCEPT_LABELS[numeric];
  }
  return String(value);
};

export const formatDocumentTypeLabel = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const key = String(value);
  return DOCUMENT_LABELS[key] ?? key;
};

export const formatExchangeRate = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return numeric.toFixed(4);
};
