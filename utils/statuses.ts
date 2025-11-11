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

export const isStatusFacturado = (status?: Pick<Status, 'label'> | null): boolean => {
  if (!status || typeof status.label !== 'string') {
    return false;
  }

  const normalized = normalizeStatusLabel(status.label);
  if (!normalized) {
    return false;
  }

  return FACTURADO_KEYWORDS.some(keyword => normalized.includes(keyword));
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
