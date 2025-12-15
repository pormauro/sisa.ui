import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import { useCachedState } from '@/hooks/useCachedState';
import { NetworkEvent, initializeNetworkSniffer, onNetworkEvent } from '@/utils/networkSniffer';
import { NetworkLogEntry, generateLogId } from '@/utils/networkLogger';

const MAX_LOG_ITEMS = 200;

interface NetworkLogContextValue {
  logs: NetworkLogEntry[];
  appendLog: (
    entry: Omit<NetworkLogEntry, 'timestamp' | 'id'> & { id?: string; timestamp?: number }
  ) => void;
  clearLogs: () => void;
  captureEnabled: boolean;
  setCaptureEnabled: (enabled: boolean) => void;
}

const NetworkLogContext = createContext<NetworkLogContextValue | undefined>(undefined);

export const NetworkLogProvider = ({ children }: { children: React.ReactNode }) => {
  const [logs, setLogs] = useCachedState<NetworkLogEntry[]>('networkLogs', []);
  const [captureEnabled, setCaptureEnabled] = useCachedState<boolean>('networkLogsCapture', true);

  const hydrateMissingIds = useCallback(() => {
    setLogs(previous => {
      const needsUpdate = previous.some(log => !log.id);
      if (!needsUpdate) {
        return previous;
      }

      return previous.map(log => ({ ...log, id: log.id ?? generateLogId() }));
    });
  }, [setLogs]);

  const appendLog = useCallback(
    (entry: Omit<NetworkLogEntry, 'timestamp' | 'id'> & { id?: string; timestamp?: number }) => {
      setLogs(previous => {
        const next: NetworkLogEntry[] = [
          ...previous,
          {
            id: entry.id ?? generateLogId(),
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
    hydrateMissingIds();
  }, [hydrateMissingIds]);

  useEffect(() => {
    initializeNetworkSniffer();
    const pendingEvents = new Map<string, NetworkEvent>();

    const unsubscribe = onNetworkEvent(event => {
      if (!captureEnabled) {
        return;
      }

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
  }, [appendLog, captureEnabled]);

  const value = useMemo<NetworkLogContextValue>(
    () => ({ logs, appendLog, clearLogs, captureEnabled, setCaptureEnabled }),
    [appendLog, captureEnabled, clearLogs, logs, setCaptureEnabled],
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
