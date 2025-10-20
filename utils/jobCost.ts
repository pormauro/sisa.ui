const normalizeTime = (time?: string | null): string | null => {
  if (!time) {
    return null;
  }

  const trimmed = time.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const [hours, minutes, seconds = '00'] = parts;
    const paddedHours = hours.padStart(2, '0');
    const paddedMinutes = minutes.padStart(2, '0');
    const paddedSeconds = seconds.padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return null;
};

export const calculateWorkedHours = (
  start?: string | null,
  end?: string | null
): number | null => {
  const normalizedStart = normalizeTime(start);
  const normalizedEnd = normalizeTime(end);

  if (!normalizedStart || !normalizedEnd) {
    return null;
  }

  const startDate = new Date(`1970-01-01T${normalizedStart}`);
  const endDate = new Date(`1970-01-01T${normalizedEnd}`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const diffMs = endDate.getTime() - startDate.getTime();

  if (diffMs <= 0) {
    return null;
  }

  return diffMs / (1000 * 60 * 60);
};

export const calculateJobTotal = (
  rate: number | null | undefined,
  start?: string | null,
  end?: string | null
): number | null => {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) {
    return null;
  }

  const hours = calculateWorkedHours(start, end);

  if (hours === null) {
    return null;
  }

  return hours * rate;
};
