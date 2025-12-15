const maskHeaderValue = (key: string, value: string): string => {
  if (/authorization|token/i.test(key)) {
    if (/^Bearer\s+/i.test(value)) {
      return 'Bearer ***';
    }
    return '***';
  }
  return value;
};

const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  const normalized: Record<string, string> = {};

  if (!headers) {
    return normalized;
  }

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = maskHeaderValue(key, value);
    });
    return normalized;
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      normalized[key] = maskHeaderValue(key, String(value));
    });
    return normalized;
  }

  Object.entries(headers).forEach(([key, value]) => {
    normalized[key] = maskHeaderValue(key, String(value));
  });

  return normalized;
};

export type NetworkEvent = {
  id: string;
  type: 'fetch' | 'xhr';
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  responseBody?: any;
  status?: number;
  error?: any;
  aborted?: boolean;
  startTime: number;
  endTime?: number;
};

type Listener = (event: NetworkEvent) => void;

const listeners: Listener[] = [];
let isInitialized = false;

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

export const onNetworkEvent = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
};

const emit = (event: NetworkEvent) => {
  listeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('[networkSniffer] Listener error', error);
    }
  });
};

const installFetchSniffer = () => {
  if (typeof fetch !== 'function') {
    return;
  }

  const originalFetch = fetch.bind(globalThis);

  const patchedFetch: typeof fetch = async (input: any, init?: RequestInit) => {
    const id = createId();
    const startTime = Date.now();

    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    const method =
      init?.method ??
      (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');
    const headers =
      init?.headers ??
      (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
    const body = init?.body ?? (typeof Request !== 'undefined' && input instanceof Request ? input.body : undefined);

    const baseEvent: NetworkEvent = {
      id,
      type: 'fetch',
      method,
      url: String(url),
      headers: normalizeHeaders(headers),
      body,
      startTime,
    };

    emit(baseEvent);

    try {
      const response = await originalFetch(input, init);
      let responseBody: unknown;
      try {
        const cloned = response.clone();
        responseBody = await cloned.json().catch(async () => (await cloned.text()) || null);
      } catch (parseError) {
        console.warn('[networkSniffer] Failed to parse fetch response', parseError);
        responseBody = undefined;
      }

      emit({
        ...baseEvent,
        status: response.status,
        responseBody,
        endTime: Date.now(),
      });

      return response;
    } catch (error) {
      emit({
        ...baseEvent,
        error,
        endTime: Date.now(),
      });
      throw error;
    }
  };

  (globalThis as any).fetch = patchedFetch;
};

const installXhrSniffer = () => {
  const OriginalXHR = (globalThis as any).XMLHttpRequest;
  if (!OriginalXHR) {
    return;
  }

  (globalThis as any).XMLHttpRequest = function PatchedXMLHttpRequest(this: XMLHttpRequest) {
    const xhr = new OriginalXHR();
    const id = createId();
    let url = '';
    let method = 'GET';
    let headers: Record<string, string> = {};
    let body: any;
    let startTime = Date.now();

    const emitStart = () => {
      startTime = Date.now();
      emit({
        id,
        type: 'xhr',
        method,
        url,
        headers,
        body,
        startTime,
      });
    };

    const originalOpen = xhr.open;
    xhr.open = function (m: string, u: string, ...rest: any[]) {
      method = m;
      url = u;
      return originalOpen.apply(xhr, [m, u, ...rest]);
    };

    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function (header: string, value: string) {
      headers = {
        ...headers,
        [header]: maskHeaderValue(header, value),
      };
      return originalSetRequestHeader.apply(xhr, [header, value]);
    };

    const originalSend = xhr.send;
    xhr.send = function (data?: Document | BodyInit | null) {
      body = data;
      emitStart();
      return originalSend.call(xhr, data as any);
    };

    const finalize = (partial: Partial<NetworkEvent>) => {
      let responseBody: unknown = undefined;
      try {
        if (xhr.responseType === '' || xhr.responseType === 'text') {
          responseBody = xhr.responseText;
        } else if (xhr.responseType === 'json') {
          responseBody = xhr.response;
        } else if (typeof xhr.response !== 'undefined') {
          responseBody = xhr.response;
        }
      } catch (error) {
        console.warn('[networkSniffer] Failed to read XHR response', error);
      }

      emit({
        id,
        type: 'xhr',
        method,
        url,
        headers,
        body,
        startTime,
        responseBody,
        ...partial,
      });
    };

    xhr.addEventListener('loadend', () => {
      finalize({ status: xhr.status, endTime: Date.now() });
    });

    xhr.addEventListener('error', () => {
      finalize({ error: 'Network error', endTime: Date.now() });
    });

    xhr.addEventListener('abort', () => {
      finalize({ error: 'Aborted', aborted: true, endTime: Date.now() });
    });

    return xhr;
  } as typeof XMLHttpRequest;
};

export const initializeNetworkSniffer = () => {
  if (isInitialized) {
    return;
  }
  isInitialized = true;
  installFetchSniffer();
  installXhrSniffer();
};

initializeNetworkSniffer();
