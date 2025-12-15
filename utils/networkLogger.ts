type HeadersObject = Record<string, string>;

const maskHeaderValue = (key: string, value: string): string => {
  if (/authorization|token/i.test(key)) {
    if (/^Bearer\s+/i.test(value)) {
      return value;
    }
    return '***';
  }
  return value;
};

const normalizeHeaders = (headers?: HeadersInit): HeadersObject => {
  const normalized: HeadersObject = {};

  if (!headers) {
    return normalized;
  }

  if (headers instanceof Headers) {
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

const fetchWithTimeout = async (resource: string, options: any = {}, fetcher: typeof fetch) => {
  const { timeout, ...rest } = options;
  if (!timeout) {
    return fetcher(resource, rest);
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(resource, { ...rest, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
};

export const generateLogId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export interface NetworkLogEntry {
  id: string;
  timestamp: number;
  request: {
    method: string;
    url: string;
    headers?: HeadersObject;
    body?: unknown;
  };
  response?: unknown;
  status?: number;
  duration: number;
  error?: string;
}

export interface LoggedFetchRequest extends RequestInit {
  url: string;
  method?: string;
  timeout?: number;
}

export const loggedFetch = async (
  { url, method = 'GET', headers, body, timeout, ...options }: LoggedFetchRequest,
  appendLog: (entry: NetworkLogEntry) => void,
  fetcher?: typeof fetch,
): Promise<Response> => {
  const startedAt = Date.now();
  let response: Response | null = null;
  let responseBody: unknown;
  let errorMessage: string | undefined;

  const resolvedFetcher = fetcher ?? (globalThis as any).__NETWORK_LOGGER_FETCH__ ?? fetch;

  try {
    const requestOptions: RequestInit & { timeout?: number } = {
      ...options,
      method,
      headers,
      body,
      timeout,
    };

      response = await fetchWithTimeout(url, requestOptions, resolvedFetcher);
    try {
      const cloned = response.clone();
      responseBody = await cloned.json().catch(async () => (await cloned.text()) || null);
    } catch (parseError) {
      responseBody = undefined;
    }
    return response;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    const duration = Date.now() - startedAt;
    appendLog({
      id: generateLogId(),
      timestamp: startedAt,
      request: {
        method,
        url,
        headers: normalizeHeaders(headers),
        body,
      },
      response: responseBody,
      status: response?.status,
      duration,
      error: errorMessage,
    });
  }
};

