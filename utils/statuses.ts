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

const NEGATIVE_LOOKBACK_WINDOW = 5;

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

    // Treat negative keywords that appear shortly before the billing keyword as blockers.
    // This prevents phrases such as "no facturado" or "no está facturado" from being
    // classified as invoiced, while still allowing positive contexts like
    // "facturado (no pagado)" where the negative term appears after the keyword.
    let hasNegativePrefix = false;
    for (let offset = 1; offset <= NEGATIVE_LOOKBACK_WINDOW; offset += 1) {
      const precedingWord = words[index - offset];
      if (precedingWord === undefined) {
        break;
      }

      if (NEGATIVE_STATUS_KEYWORDS.has(precedingWord)) {
        hasNegativePrefix = true;
        break;
      }
    }

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
