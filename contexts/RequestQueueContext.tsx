import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useCachedState } from '@/hooks/useCachedState';
import { AuthContext } from '@/contexts/AuthContext';

export type RequestStatus = 'pending' | 'success' | 'error' | 'aborted';

export interface RequestTrace {
  id: string;
  url: string;
  method: string;
  status: RequestStatus;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  statusCode?: number;
  errorMessage?: string;
}

interface RequestQueueContextValue {
  queue: RequestTrace[];
  pendingCount: number;
  hydrated: boolean;
  clearQueue: () => void;
}

const MAX_TRACKED_REQUESTS = 200;

export const RequestQueueContext = createContext<RequestQueueContextValue | undefined>(undefined);

const getMethodFromInput = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (input instanceof Request && input.method) {
    return input.method.toUpperCase();
  }

  return 'GET';
};

const getUrlFromInput = (input: RequestInfo | URL): string => {
  if (input instanceof Request && input.url) {
    return input.url;
  }

  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return 'desconocido';
};

export const RequestQueueProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { userId } = useContext(AuthContext);
  const [queue, setQueue, hydrated] = useCachedState<RequestTrace[]>('requestQueue', []);
  const originalFetchRef = useRef<typeof fetch | null>(null);
  const patchedRef = useRef(false);

  const pushRequest = useCallback(
    (entry: RequestTrace) => {
      setQueue(previous => {
        const next = [...previous, entry];
        if (next.length > MAX_TRACKED_REQUESTS) {
          return next.slice(next.length - MAX_TRACKED_REQUESTS);
        }
        return next;
      });
    },
    [setQueue],
  );

  const updateRequest = useCallback(
    (id: string, updates: Partial<RequestTrace>) => {
      setQueue(previous => previous.map(item => (item.id === id ? { ...item, ...updates } : item)));
    },
    [setQueue],
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, [setQueue]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const originalFetch = globalThis.fetch;
    originalFetchRef.current = originalFetch;

    if (patchedRef.current) {
      return;
    }

    const trackedFetch: typeof fetch = async (input, init) => {
      const startedAt = Date.now();
      const id = `${startedAt}-${Math.random().toString(36).slice(2, 10)}`;
      const method = getMethodFromInput(input, init);
      const url = getUrlFromInput(input);

      pushRequest({ id, method, url, startedAt, status: 'pending' });

      try {
        const response = await originalFetch(input as any, init as any);
        const endedAt = Date.now();
        const durationMs = endedAt - startedAt;

        updateRequest(id, {
          status: response.ok ? 'success' : 'error',
          statusCode: response.status,
          endedAt,
          durationMs,
        });

        return response;
      } catch (error: any) {
        const endedAt = Date.now();
        const durationMs = endedAt - startedAt;
        const errorMessage = typeof error?.message === 'string' ? error.message : String(error);
        const status: RequestStatus = error?.name === 'AbortError' ? 'aborted' : 'error';

        updateRequest(id, {
          status,
          endedAt,
          durationMs,
          errorMessage,
        });

        throw error;
      }
    };

    globalThis.fetch = trackedFetch;
    patchedRef.current = true;

    return () => {
      if (originalFetchRef.current) {
        globalThis.fetch = originalFetchRef.current;
      }
      patchedRef.current = false;
    };
  }, [hydrated, pushRequest, updateRequest]);

  useEffect(() => {
    if (!userId) {
      clearQueue();
    }
  }, [clearQueue, userId]);

  const pendingCount = useMemo(() => queue.filter(item => item.status === 'pending').length, [queue]);

  const value = useMemo<RequestQueueContextValue>(
    () => ({ queue, pendingCount, hydrated, clearQueue }),
    [clearQueue, hydrated, pendingCount, queue],
  );

  return <RequestQueueContext.Provider value={value}>{children}</RequestQueueContext.Provider>;
};

export const useRequestQueue = (): RequestQueueContextValue => {
  const context = useContext(RequestQueueContext);
  if (!context) {
    throw new Error('useRequestQueue debe usarse dentro de un RequestQueueProvider');
  }
  return context;
};
