export const formatCurrency = (
  value: unknown,
  options: {
    locale?: string;
    currency?: string;
    minimumFractionDigits?: number;
  } = {}
): string => {
  const { locale = 'es-AR', currency = 'ARS', minimumFractionDigits = 2 } = options;

  if (value === null || value === undefined) {
    return '—';
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return '—';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
  }).format(numericValue);
};

export const toNumericValue = (
  value: number | string | null | undefined
): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  return numericValue;
};
