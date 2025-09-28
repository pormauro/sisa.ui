export type SortableDate = string | number | Date | null | undefined;

const MIN_COMPARABLE_VALUE = Number.NEGATIVE_INFINITY;

const toComparableNumber = (value: SortableDate): number => {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? MIN_COMPARABLE_VALUE : time;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : MIN_COMPARABLE_VALUE;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return MIN_COMPARABLE_VALUE;
    }

    const directTimestamp = Date.parse(trimmed);
    if (!Number.isNaN(directTimestamp)) {
      return directTimestamp;
    }

    const isoCandidate = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
    if (isoCandidate !== trimmed) {
      const isoTimestamp = Date.parse(isoCandidate);
      if (!Number.isNaN(isoTimestamp)) {
        return isoTimestamp;
      }
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return MIN_COMPARABLE_VALUE;
};

export const sortByNewest = <T>(
  items: T[],
  getPrimary: (item: T) => SortableDate,
  getSecondary?: (item: T) => SortableDate
): T[] => {
  const copy = [...items];
  copy.sort((a, b) => {
    const primaryDiff = toComparableNumber(getPrimary(b)) - toComparableNumber(getPrimary(a));
    if (primaryDiff !== 0) {
      return primaryDiff;
    }
    if (getSecondary) {
      return toComparableNumber(getSecondary(b)) - toComparableNumber(getSecondary(a));
    }
    return 0;
  });
  return copy;
};

export const getDefaultSortValue = <T extends { id?: number | string }>(
  item: T & Partial<{ created_at?: string | null; updated_at?: string | null }>
): SortableDate => {
  if (item.created_at) {
    return item.created_at;
  }
  if (item.updated_at) {
    return item.updated_at;
  }
  return typeof item.id === 'string' ? Number(item.id) : item.id;
};

export const ensureSortedByNewest = <T>(
  items: T[],
  getPrimary: (item: T) => SortableDate,
  getSecondary?: (item: T) => SortableDate
): T[] => {
  const sorted = sortByNewest(items, getPrimary, getSecondary);
  const hasChanges =
    sorted.length !== items.length || sorted.some((item, index) => item !== items[index]);
  return hasChanges ? sorted : items;
};
