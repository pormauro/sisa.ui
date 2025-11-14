/**
 * Normalizes CUIT/tax identifiers by trimming whitespace and discarding
 * placeholder values (legacy APIs sometimes return `1` when the field is empty).
 */
export const normalizeTaxId = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed && trimmed !== '1' ? trimmed : '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = String(value).trim();
    return normalized && normalized !== '1' ? normalized : '';
  }

  return '';
};
