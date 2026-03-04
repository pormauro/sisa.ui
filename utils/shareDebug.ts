import { getCachedData, setCachedData } from '@/utils/cache';

const SHARE_DEBUG_CACHE_KEY = 'shareDebugHistory';
const MAX_SHARE_DEBUG_ITEMS = 300;

export interface ShareDebugEntry {
  id: string;
  timestamp: number;
  stage: string;
  changedKeys: string[];
  values: Record<string, unknown>;
}

let lastSnapshot: Record<string, unknown> | null = null;

const safeClone = (value: unknown): unknown => {
  if (value === undefined) {
    return '[undefined]';
  }

  if (typeof value === 'function') {
    return `[function:${value.name || 'anonymous'}]`;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
};

const sanitizeValues = (values: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};

  Object.entries(values).forEach(([key, value]) => {
    sanitized[key] = safeClone(value);
  });

  return sanitized;
};

const getChangedKeys = (
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>
): string[] => {
  if (!previous) {
    return Object.keys(current);
  }

  return Object.keys(current).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(current[key]));
};

export const recordShareDebug = (stage: string, values: Record<string, unknown>): void => {
  const sanitizedValues = sanitizeValues(values);
  const changedKeys = getChangedKeys(lastSnapshot, sanitizedValues);

  const entry: ShareDebugEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: Date.now(),
    stage,
    changedKeys,
    values: sanitizedValues,
  };

  lastSnapshot = sanitizedValues;

  console.warn('[ShareDebug]', stage, { changedKeys, values: sanitizedValues });

  void (async () => {
    const existing = (await getCachedData<ShareDebugEntry[]>(SHARE_DEBUG_CACHE_KEY)) ?? [];
    const next = [...existing, entry];
    const limited = next.length > MAX_SHARE_DEBUG_ITEMS
      ? next.slice(next.length - MAX_SHARE_DEBUG_ITEMS)
      : next;

    await setCachedData(SHARE_DEBUG_CACHE_KEY, limited);
  })();
};

export const getShareDebugHistory = async (): Promise<ShareDebugEntry[]> => {
  const existing = (await getCachedData<ShareDebugEntry[]>(SHARE_DEBUG_CACHE_KEY)) ?? [];
  return existing;
};

export const clearShareDebugHistory = async (): Promise<void> => {
  await setCachedData(SHARE_DEBUG_CACHE_KEY, [] as ShareDebugEntry[]);
  lastSnapshot = null;
};
