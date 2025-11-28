export type DaySeparatedItem<T> =
  | { type: 'separator'; id: string; label: string }
  | { type: 'item'; value: T };

const padNumber = (value: number): string => value.toString().padStart(2, '0');

const parseDateValue = (value?: string | null): Date | null => {
  if (!value) return null;
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const buildDateKey = (value?: string | null): string => {
  const date = parseDateValue(value);
  if (!date) return 'sin-fecha';
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  return `${year}-${month}-${day}`;
};

const capitalize = (text: string): string =>
  text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);

const formatDayLabel = (value?: string | null): string => {
  const date = parseDateValue(value);
  if (!date) return 'Sin fecha';
  const label = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return capitalize(label);
};

export const withDaySeparators = <T,>(
  items: T[],
  getDateValue: (item: T) => string | null | undefined,
): DaySeparatedItem<T>[] => {
  const result: DaySeparatedItem<T>[] = [];
  let lastKey: string | null = null;

  items.forEach((item, index) => {
    const dateValue = getDateValue(item);
    const dateKey = buildDateKey(dateValue);

    if (dateKey !== lastKey) {
      result.push({
        type: 'separator',
        id: `${dateKey}-${index}`,
        label: formatDayLabel(dateValue),
      });
      lastKey = dateKey;
    }

    result.push({ type: 'item', value: item });
  });

  return result;
};
