import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

import { AfipEvent, normaliseAfipEvent } from './InvoicesContext';

export interface AfipEventsFilters {
  invoiceId?: number | null;
  pointOfSale?: string | number | null;
  from?: string | null;
  to?: string | null;
}

interface AfipEventsContextValue {
  events: AfipEvent[];
  filteredEvents: AfipEvent[];
  filters: AfipEventsFilters;
  setFilters: React.Dispatch<React.SetStateAction<AfipEventsFilters>>;
  loadEvents: (overrideFilters?: Partial<AfipEventsFilters>) => Promise<void>;
  isLoading: boolean;
  lastUpdatedAt: Date | null;
}

const defaultFilters: AfipEventsFilters = {};

const AfipEventsContext = createContext<AfipEventsContextValue | undefined>(
  undefined
);

const extractEventList = (payload: unknown): unknown[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidates = ['events', 'data', 'items', 'results', 'logs'];
    for (const key of candidates) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
};

const normaliseFilterValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
};

export const AfipEventsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { token } = useContext(AuthContext);
  const [events, setEvents] = useCachedState<AfipEvent[]>('afipEvents', []);
  const [filtersState, setFiltersState] = useState<AfipEventsFilters>(defaultFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const filtersRef = useRef<AfipEventsFilters>(filtersState);

  const setFilters = useCallback<
    React.Dispatch<React.SetStateAction<AfipEventsFilters>>
  >(
    value => {
      setFiltersState(prev => {
        const next = typeof value === 'function' ? (value as any)(prev) : value;
        filtersRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    filtersRef.current = filtersState;
  }, [filtersState]);

  const loadEvents = useCallback(
    async (overrideFilters?: Partial<AfipEventsFilters>) => {
      if (!token) {
        return;
      }

      setIsLoading(true);
      try {
        const effectiveFilters = {
          ...filtersRef.current,
          ...overrideFilters,
        };
        const searchParams = new URLSearchParams();
        if (effectiveFilters.invoiceId) {
          searchParams.set('invoice_id', String(effectiveFilters.invoiceId));
        }
        if (effectiveFilters.pointOfSale) {
          searchParams.set('point_of_sale', String(effectiveFilters.pointOfSale));
        }
        if (effectiveFilters.from) {
          searchParams.set('from', normaliseFilterValue(effectiveFilters.from));
        }
        if (effectiveFilters.to) {
          searchParams.set('to', normaliseFilterValue(effectiveFilters.to));
        }

        const query = searchParams.toString();
        const url = `${BASE_URL}/afip/events${query ? `?${query}` : ''}`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${url} ${text}`);
        }

        const payload = await response.json().catch(() => ({}));
        const parsed = extractEventList(payload)
          .map(normaliseAfipEvent)
          .filter((event): event is AfipEvent => event !== null);

        setEvents(parsed);
        if (overrideFilters) {
          setFilters(() => effectiveFilters);
        }
        setLastUpdatedAt(new Date());
      } catch (error) {
        console.error('Error loading AFIP events:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [setEvents, setFilters, token]
  );

  useEffect(() => {
    if (token) {
      void loadEvents();
    }
  }, [loadEvents, token]);

  const filteredEvents = useMemo(() => {
    const filters = filtersState;
    if (!filters.invoiceId && !filters.pointOfSale && !filters.from && !filters.to) {
      return events;
    }

    const fromDate = filters.from ? new Date(filters.from) : null;
    const toDate = filters.to ? new Date(filters.to) : null;

    return events.filter(event => {
      if (filters.invoiceId) {
        const invoiceIdRaw =
          event.invoice_id ?? event.invoiceId ?? (event as any)['invoice'];
        if (invoiceIdRaw && Number(invoiceIdRaw) !== Number(filters.invoiceId)) {
          return false;
        }
      }

      if (filters.pointOfSale) {
        const pointOfSaleRaw =
          event.point_of_sale ?? event.pointOfSale ?? (event as any)['pos'];
        if (
          pointOfSaleRaw &&
          String(pointOfSaleRaw).toLowerCase() !==
            String(filters.pointOfSale).toLowerCase()
        ) {
          return false;
        }
      }

      if (fromDate || toDate) {
        const createdAtRaw = event.created_at ?? event.createdAt;
        if (!createdAtRaw) {
          return false;
        }
        const createdAt = new Date(createdAtRaw);
        if (Number.isNaN(createdAt.getTime())) {
          return false;
        }
        if (fromDate && createdAt < fromDate) {
          return false;
        }
        if (toDate && createdAt > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [events, filtersState]);

  const value = useMemo(
    () => ({
      events,
      filteredEvents,
      filters: filtersState,
      setFilters,
      loadEvents,
      isLoading,
      lastUpdatedAt,
    }),
    [events, filteredEvents, filtersState, isLoading, lastUpdatedAt, loadEvents]
  );

  return (
    <AfipEventsContext.Provider value={value}>
      {children}
    </AfipEventsContext.Provider>
  );
};

export const useAfipEvents = (): AfipEventsContextValue => {
  const context = useContext(AfipEventsContext);
  if (!context) {
    throw new Error('useAfipEvents must be used within an AfipEventsProvider');
  }
  return context;
};
