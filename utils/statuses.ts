import type { Status } from '@/contexts/StatusesContext';

const FACTURADO_KEYWORDS = [
  'facturado',
  'facturada',
  'facturados',
  'facturadas',
  'invoiced',
  'billed',
];
const FACTURADO_KEYWORD_SET = new Set(FACTURADO_KEYWORDS);

const normalizeStatusLabel = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const tokenizeNormalizedStatusLabel = (normalizedLabel: string): string[] =>
  normalizedLabel
    .split(/[^a-z0-9]+/)
    .map(part => part.trim())
    .filter(Boolean);

const NEGATIVE_STATUS_KEYWORDS = new Set(['no', 'sin', 'not', 'non', 'without']);

export const isStatusFacturado = (status?: Pick<Status, 'label'> | null): boolean => {
  if (!status || typeof status.label !== 'string') {
    return false;
  }

  const normalized = normalizeStatusLabel(status.label);
  if (!normalized) {
    return false;
  }

  const words = tokenizeNormalizedStatusLabel(normalized);
  if (words.length === 0) {
    return false;
  }

  for (let index = 0; index < words.length; index += 1) {
    const currentWord = words[index];
    if (!FACTURADO_KEYWORD_SET.has(currentWord)) {
      continue;
    }

    // Only treat negative words that appear immediately before the billing keyword
    // as blockers. This avoids unrelated negative terms earlier in the label from
    // preventing a facturado classification.
    const immediatePrecedingWord = words[index - 1];
    const hasNegativePrefix =
      immediatePrecedingWord !== undefined &&
      NEGATIVE_STATUS_KEYWORDS.has(immediatePrecedingWord);

    if (!hasNegativePrefix) {
      return true;
    }
  }

  return false;
};

export const buildFacturadoStatusIdSet = (statuses: Status[]): Set<number> => {
  const ids = new Set<number>();
  statuses.forEach(status => {
    if (isStatusFacturado(status)) {
      ids.add(status.id);
    }
  });
  return ids;
};

export const FACTURADO_STATUS_KEYWORDS = FACTURADO_KEYWORDS;
