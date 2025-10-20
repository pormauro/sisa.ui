import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCachedState } from '@/hooks/useCachedState';
import { AfipEvent, parseAfipEventsCollection } from '@/types/afip';

interface AfipEventsFilters {
  invoiceId?: number | null;
  pointOfSaleId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
}

interface AfipEventsContextValue {
  events: AfipEvent[];
  filteredEvents: AfipEvent[];
  filters: AfipEventsFilters;
  setFilters: React.Dispatch<React.SetStateAction<AfipEventsFilters>>;
  loadEvents: () => Promise<void>;
  isLoading: boolean;
  lastSyncError: string | null;
  hydrated: boolean;
}

const noop = async () => {};

const AfipEventsContext = createContext<AfipEventsContextValue>({
  events: [],
  filteredEvents: [],
  filters: {},
  setFilters: () => {},
  loadEvents: noop,
  isLoading: false,
  lastSyncError: null,
  hydrated: false,
});

const extractEventCandidates = (payload: unknown, depth = 0): unknown => {
  if (!payload || depth > 3) {
    return [];
  }

  const parsed = parseAfipEventsCollection(payload);
  if (parsed.length > 0) {
    return parsed;
  }

  if (typeof payload === 'string') {
    try {
      const nested = JSON.parse(payload);
      return extractEventCandidates(nested, depth + 1);
    } catch {
      return [];
    }
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const keys = ['events', 'data', 'items', 'results', 'logs', 'afip_events'];
    for (const key of keys) {
      if (key in record) {
        const nested = extractEventCandidates(record[key], depth + 1);
        const parsedNested = parseAfipEventsCollection(nested);
        if (parsedNested.length > 0) {
          return parsedNested;
        }
      }
    }
  }

  return [];
};

const getEventTimestamp = (event: AfipEvent): number => {
  const candidate = event.updated_at ?? event.created_at ?? null;
  if (!candidate) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Date.parse(candidate);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const isoCandidate = candidate.includes(' ') ? candidate.replace(' ', 'T') : candidate;
  const isoParsed = Date.parse(isoCandidate);
  if (!Number.isNaN(isoParsed)) {
    return isoParsed;
  }
  if (event.id) {
    const numeric = Number(event.id);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }
  return Number.NEGATIVE_INFINITY;
};

export const AfipEventsProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const [events, setEvents, hydrated] = useCachedState<AfipEvent[]>('afip-events', []);
  const [filters, setFilters] = useState<AfipEventsFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const canList = permissions.includes('listAfipEvents');

  useEffect(() => {
    if (!canList) {
      setEvents([]);
    }
  }, [canList, setEvents]);

  const loadEvents = useCallback(async () => {
    if (!token || !canList) {
      return;
    }

    setIsLoading(true);
    setLastSyncError(null);

    try {
      const response = await fetch(`${BASE_URL}/afip/events`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} /afip/events ${text}`.trim());
      }

      const payload = await response.json().catch(() => ({}));
      const extracted = extractEventCandidates(payload);
      const parsed = parseAfipEventsCollection(extracted);
      const sorted = parsed.sort((a, b) => getEventTimestamp(b) - getEventTimestamp(a));
      setEvents(sorted);
    } catch (error) {
      console.error('Error loading AFIP events:', error);
      setLastSyncError(error instanceof Error ? error.message : 'Error desconocido al cargar eventos AFIP');
    } finally {
      setIsLoading(false);
    }
  }, [canList, setEvents, token]);

  useEffect(() => {
    if (token && canList) {
      void loadEvents();
    }
  }, [canList, loadEvents, token]);

  const filteredEvents = useMemo(() => {
    const fromTs = filters.fromDate ? new Date(filters.fromDate).setHours(0, 0, 0, 0) : null;
    const toTs = filters.toDate ? new Date(filters.toDate).setHours(23, 59, 59, 999) : null;

    return events.filter(event => {
      if (filters.invoiceId && event.invoice_id && Number(event.invoice_id) !== Number(filters.invoiceId)) {
        return false;
      }
      if (
        filters.pointOfSaleId &&
        event.afip_point_of_sale_id &&
        Number(event.afip_point_of_sale_id) !== Number(filters.pointOfSaleId)
      ) {
        return false;
      }

      const timestamp = getEventTimestamp(event);
      if (fromTs && timestamp < fromTs) {
        return false;
      }
      if (toTs && timestamp > toTs) {
        return false;
      }

      return true;
    });
  }, [events, filters]);

  const value = useMemo<AfipEventsContextValue>(
    () => ({ events, filteredEvents, filters, setFilters, loadEvents, isLoading, lastSyncError, hydrated }),
    [events, filteredEvents, filters, hydrated, isLoading, lastSyncError, loadEvents]
  );

  return <AfipEventsContext.Provider value={value}>{children}</AfipEventsContext.Provider>;
};

export const useAfipEvents = (): AfipEventsContextValue => {
  const context = useContext(AfipEventsContext);
  if (!context) {
    throw new Error('useAfipEvents debe utilizarse dentro de AfipEventsProvider');
  }
  return context;
};
