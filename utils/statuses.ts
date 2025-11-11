import type { Status } from '@/contexts/StatusesContext';

const FACTURADO_KEYWORDS = [
  'facturado',
  'facturada',
  'facturados',
  'facturadas',
  'invoiced',
  'billed',
];

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

  return words.some((word, index) => {
    if (!FACTURADO_KEYWORDS.includes(word)) {
      return false;
    }

    const precedingWords = words.slice(0, index);
    const hasNegativePrefix = precedingWords.some(precedingWord =>
      NEGATIVE_STATUS_KEYWORDS.has(precedingWord),
    );

    return !hasNegativePrefix;
  });
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
