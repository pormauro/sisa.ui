import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import { useCachedState } from '@/hooks/useCachedState';
import { NetworkEvent, initializeNetworkSniffer, onNetworkEvent } from '@/utils/networkSniffer';
import { NetworkLogEntry } from '@/utils/networkLogger';

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
    initializeNetworkSniffer();
    const pendingEvents = new Map<string, NetworkEvent>();

    const unsubscribe = onNetworkEvent(event => {
      if (!event.endTime) {
        pendingEvents.set(event.id, event);
        return;
      }

      const startEvent = pendingEvents.get(event.id) ?? event;
      pendingEvents.delete(event.id);

      const duration = Math.max(event.endTime - startEvent.startTime, 0);
      const errorMessage = event.error
        ? event.error instanceof Error
          ? event.error.message
          : String(event.error)
        : undefined;

      appendLog({
        timestamp: startEvent.startTime,
        request: {
          method: startEvent.method,
          url: startEvent.url,
          headers: startEvent.headers,
          body: startEvent.body,
        },
        response: event.responseBody,
        status: event.status,
        duration,
        error: errorMessage,
      });
    });

    return () => {
      pendingEvents.clear();
      unsubscribe();
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
