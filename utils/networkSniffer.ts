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
  const OriginalXHR: typeof XMLHttpRequest | undefined = (globalThis as any).XMLHttpRequest;
  if (!OriginalXHR) {
    return;
  }

  class PatchedXMLHttpRequest extends OriginalXHR {
    private id = createId();
    private url = '';
    private method = 'GET';
    private headers: Record<string, string> = {};
    private body: any;
    private startTime = Date.now();

    constructor() {
      super();

      this.addEventListener('loadend', () => {
        this.finalize({ status: this.status, endTime: Date.now() });
      });

      this.addEventListener('error', () => {
        this.finalize({ error: 'Network error', endTime: Date.now() });
      });

      this.addEventListener('abort', () => {
        this.finalize({ error: 'Aborted', aborted: true, endTime: Date.now() });
      });
    }

    override open(
      method: string,
      url: string,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      this.method = method;
      this.url = url;
      return super.open(method, url, async, username, password);
    }

    override setRequestHeader(header: string, value: string) {
      this.headers = {
        ...this.headers,
        [header]: maskHeaderValue(header, value),
      };
      return super.setRequestHeader(header, value);
    }

    override send(data?: Document | BodyInit | null) {
      this.body = data;
      this.emitStart();
      return super.send(data as any);
    }

    private emitStart() {
      this.startTime = Date.now();
      emit({
        id: this.id,
        type: 'xhr',
        method: this.method,
        url: this.url,
        headers: this.headers,
        body: this.body,
        startTime: this.startTime,
      });
    }

    private finalize(partial: Partial<NetworkEvent>) {
      let responseBody: unknown = undefined;
      try {
        if (this.responseType === '' || this.responseType === 'text') {
          responseBody = this.responseText;
        } else if (this.responseType === 'json') {
          responseBody = this.response;
        } else if (typeof this.response !== 'undefined') {
          responseBody = this.response;
        }
      } catch (error) {
        console.warn('[networkSniffer] Failed to read XHR response', error);
      }

      emit({
        id: this.id,
        type: 'xhr',
        method: this.method,
        url: this.url,
        headers: this.headers,
        body: this.body,
        startTime: this.startTime,
        responseBody,
        ...partial,
      });
    }
  }

  (globalThis as any).XMLHttpRequest = PatchedXMLHttpRequest;
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
