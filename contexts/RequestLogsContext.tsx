import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useCachedState } from '@/hooks/useCachedState';

export interface RequestLogEntry {
  id: string;
  url: string;
  method: string;
  body?: string;
  responseBody?: string;
  status: number | null;
  timestamp: number;
}

interface RequestLogsContextValue {
  logs: RequestLogEntry[];
  clearRequestLogs: () => void;
}

const MAX_REQUEST_LOGS = 200;

const RequestLogsContext = createContext<RequestLogsContextValue | undefined>(undefined);

const safeStringify = (payload: unknown): string | undefined => {
  if (payload === null || typeof payload === 'undefined') {
    return undefined;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof FormData !== 'undefined' && payload instanceof FormData) {
    const values: string[] = [];
    payload.forEach((value, key) => {
      values.push(`${key}=${typeof value === 'string' ? value : '[archivo]'}`);
    });
    return values.join('&');
  }

  try {
    return JSON.stringify(payload);
  } catch (error) {
    console.log('No se pudo serializar el cuerpo de la petición', error);
    return String(payload);
  }
};

const resolveUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }

  if (typeof URL !== 'undefined' && input instanceof URL) {
    return input.toString();
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.url;
  }

  return String(input);
};

const resolveMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) {
    return init.method;
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method;
  }

  return 'GET';
};

const readResponseBody = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch (error) {
    console.log('No se pudo leer la respuesta del servidor', error);
    return '[No se pudo leer la respuesta del servidor]';
  }
};

export const RequestLogsProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [logs, setLogs] = useCachedState<RequestLogEntry[]>('requestLogs', []);
  const originalFetchRef = useRef<typeof fetch | null>(null);

  const appendLog = useCallback(
    (entry: Omit<RequestLogEntry, 'id'>) => {
      setLogs(previous => {
        const nextLogs = [
          ...previous,
          {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          },
        ];

        if (nextLogs.length > MAX_REQUEST_LOGS) {
          return nextLogs.slice(nextLogs.length - MAX_REQUEST_LOGS);
        }

        return nextLogs;
      });
    },
    [setLogs]
  );

  const clearRequestLogs = useCallback(() => {
    setLogs([]);
  }, [setLogs]);

  useEffect(() => {
    if (originalFetchRef.current !== null) {
      return undefined;
    }

    originalFetchRef.current = global.fetch;

    const instrumentedFetch: typeof fetch = async (input, init = {}) => {
      const method = resolveMethod(input, init);
      const url = resolveUrl(input);
      const body = safeStringify(init.body);
      const timestamp = Date.now();

      try {
        const response = await originalFetchRef.current!(input as any, init);
        const responseBody = await readResponseBody(response.clone());
        appendLog({ method, url, body, responseBody, status: response.status, timestamp });
        return response;
      } catch (error: any) {
        appendLog({
          method,
          url,
          body,
          responseBody: `Error: ${error?.message ?? String(error)}`,
          status: null,
          timestamp,
        });
        throw error;
      }
    };

    global.fetch = instrumentedFetch;

    return () => {
      if (originalFetchRef.current) {
        global.fetch = originalFetchRef.current;
      }
    };
  }, [appendLog]);

  const value = useMemo<RequestLogsContextValue>(
    () => ({ logs, clearRequestLogs }),
    [logs, clearRequestLogs]
  );

  return <RequestLogsContext.Provider value={value}>{children}</RequestLogsContext.Provider>;
};

export const useRequestLogs = (): RequestLogsContextValue => {
  const context = React.useContext(RequestLogsContext);

  if (!context) {
    throw new Error('useRequestLogs debe usarse dentro de un RequestLogsProvider');
  }

  return context;
};
