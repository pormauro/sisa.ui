import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import { useCachedState } from '@/hooks/useCachedState';
import { NetworkLogEntry, loggedFetch } from '@/utils/networkLogger';

const MAX_LOG_ITEMS = 200;

interface NetworkLogContextValue {
  logs: NetworkLogEntry[];
  appendLog: (entry: Omit<NetworkLogEntry, 'timestamp'> & { timestamp?: number }) => void;
  clearLogs: () => void;
}

const NetworkLogContext = createContext<NetworkLogContextValue | undefined>(undefined);

export const NetworkLogProvider = ({ children }: { children: React.ReactNode }) => {
  const [logs, setLogs] = useCachedState<NetworkLogEntry[]>('networkLogs', []);

  const appendLog = useCallback(
    (entry: Omit<NetworkLogEntry, 'timestamp'> & { timestamp?: number }) => {
      setLogs(previous => {
        const next: NetworkLogEntry[] = [
          ...previous,
          {
            timestamp: entry.timestamp ?? Date.now(),
            ...entry,
          },
        ];
        if (next.length > MAX_LOG_ITEMS) {
          return next.slice(next.length - MAX_LOG_ITEMS);
        }
        return next;
      });
    },
    [setLogs],
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, [setLogs]);

  useEffect(() => {
    const originalFetch = global.fetch;
    (global as any).__NETWORK_LOGGER_FETCH__ = originalFetch;

    const patchedFetch: typeof fetch = (resource: any, init?: RequestInit) => {
      const url = typeof resource === 'string' ? resource : resource?.url ?? String(resource);
      const method = init?.method ?? (resource instanceof Request ? resource.method : 'GET');
      const headers = init?.headers ?? (resource instanceof Request ? resource.headers : undefined);
      const body = init?.body ?? (resource instanceof Request ? resource.body : undefined);
      const timeout = (init as any)?.timeout ?? (resource as any)?.timeout;

      return loggedFetch(
        { url, method, headers, body, timeout, ...init },
        appendLog,
        originalFetch,
      );
    };

    global.fetch = patchedFetch;

    return () => {
      global.fetch = originalFetch;
    };
  }, [appendLog]);

  const value = useMemo<NetworkLogContextValue>(
    () => ({ logs, appendLog, clearLogs }),
    [appendLog, clearLogs, logs],
  );

  return <NetworkLogContext.Provider value={value}>{children}</NetworkLogContext.Provider>;
};

export const useNetworkLog = (): NetworkLogContextValue => {
  const context = useContext(NetworkLogContext);

  if (!context) {
    throw new Error('useNetworkLog must be used within a NetworkLogProvider');
  }

  return context;
};
