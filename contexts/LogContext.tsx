import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';

import { useCachedState } from '@/hooks/useCachedState';

export type LogType = 'error' | 'warn' | 'alert';

export interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  timestamp: number;
}

const MAX_LOG_ITEMS = 200;

interface LogContextValue {
  logs: LogEntry[];
  addLog: (entry: { type: LogType; message: string }) => void;
  clearLogs: () => void;
  overlaySuppressed: boolean;
  setOverlaySuppressed: React.Dispatch<React.SetStateAction<boolean>>;
  overlaySettingsHydrated: boolean;
}

const LogContext = createContext<LogContextValue | undefined>(undefined);

const formatArgs = (args: unknown[]): string =>
  args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }

      if (arg instanceof Error) {
        return arg.stack ?? arg.message;
      }

      try {
        return JSON.stringify(arg, null, 2);
      } catch (error) {
        return String(arg);
      }
    })
    .join(' ');

const createLogEntry = (entry: { type: LogType; message: string }): LogEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  timestamp: Date.now(),
  ...entry,
});

export const LogProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [overlaySuppressed, setOverlaySuppressed, overlaySettingsHydrated] =
    useCachedState<boolean>('logOverlaySuppressed', false);
  const originalConsoleError = useRef(console.error);
  const originalConsoleWarn = useRef(console.warn);
  const originalAlert = useRef(Alert.alert);

  const addLog = useCallback((entry: { type: LogType; message: string }) => {
    setLogs((previous) => {
      const nextLogs = [...previous, createLogEntry(entry)];
      if (nextLogs.length > MAX_LOG_ITEMS) {
        return nextLogs.slice(nextLogs.length - MAX_LOG_ITEMS);
      }
      return nextLogs;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    console.error = (...args: unknown[]) => {
      addLog({ type: 'error', message: formatArgs(args) });
      if (typeof originalConsoleError.current === 'function') {
        originalConsoleError.current.apply(console, args as any[]);
      }
    };

    console.warn = (...args: unknown[]) => {
      addLog({ type: 'warn', message: formatArgs(args) });
      if (typeof originalConsoleWarn.current === 'function') {
        originalConsoleWarn.current.apply(console, args as any[]);
      }
    };

    (Alert as any).alert = (
      ...args: Parameters<typeof Alert.alert>
    ): void => {
      const [title, message, maybeButtons] = args;
      const textParts = [title, message].filter(Boolean);
      const payload = textParts.length > 0 ? textParts.join(' - ') : 'Alerta mostrada';
      addLog({ type: 'alert', message: payload });
      const hasButtons = Array.isArray(maybeButtons) && maybeButtons.length > 0;
      if (typeof originalAlert.current === 'function' && hasButtons) {
        originalAlert.current(...args);
      }
    };

    return () => {
      console.error = originalConsoleError.current;
      console.warn = originalConsoleWarn.current;
      (Alert as any).alert = originalAlert.current;
    };
  }, [addLog]);

  const value = useMemo<LogContextValue>(
    () => ({
      logs,
      addLog,
      clearLogs,
      overlaySuppressed,
      setOverlaySuppressed,
      overlaySettingsHydrated,
    }),
    [logs, addLog, clearLogs, overlaySuppressed, setOverlaySuppressed, overlaySettingsHydrated]
  );

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
};

export const useLog = (): LogContextValue => {
  const context = useContext(LogContext);

  if (!context) {
    throw new Error('useLog must be used within a LogProvider');
  }

  return context;
};
