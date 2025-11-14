const collectAdministratorIds = (value: unknown, collector: Set<string>) => {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectAdministratorIds(item, collector));
    return;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    collector.add(String(Math.trunc(value)));
    return;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        collectAdministratorIds(parsed, collector);
        return;
      } catch (error) {
        // Ignore JSON parsing errors and fallback to direct processing
      }
    }

    if (trimmed.includes(',')) {
      trimmed
        .split(',')
        .map(segment => segment.trim())
        .filter(Boolean)
        .forEach(segment => collectAdministratorIds(segment, collector));
      return;
    }

    collector.add(trimmed);
    return;
  }

  if (typeof value === 'object') {
    const candidate =
      (value as Record<string, unknown>)?.id ??
      (value as Record<string, unknown>)?.user_id ??
      (value as Record<string, unknown>)?.userId ??
      (value as Record<string, unknown>)?.value ??
      (value as Record<string, unknown>)?.identifier;

    if (candidate !== undefined) {
      collectAdministratorIds(candidate, collector);
    }
  }
};

export const parseAdministratorIdsValue = (value: unknown): string[] => {
  const collected = new Set<string>();
  collectAdministratorIds(value, collected);
  return Array.from(collected);
};

export interface AdministratorIdsAnalysis {
  ids: string[];
  isValid: boolean;
  error: string | null;
}

export const analyzeAdministratorIdsInput = (input: string): AdministratorIdsAnalysis => {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ids: [], isValid: true, error: null };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const ids = parseAdministratorIdsValue(parsed);
    return { ids, isValid: true, error: null };
  } catch (error) {
    return {
      ids: [],
      isValid: false,
      error: 'El formato debe ser un array JSON, por ejemplo ["12", "89"].',
    };
  }
};
