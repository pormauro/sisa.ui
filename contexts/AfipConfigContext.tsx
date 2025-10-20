import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { Alert } from 'react-native';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

export type AfipEnvironment = 'homologacion' | 'produccion' | (string & {});

export interface AfipConfig {
  cuit: string;
  certificate: string;
  privateKey: string;
  environment: AfipEnvironment;
  lastSyncedAt: string | null;
  updatedAt?: string | null;
}

export interface AfipConfigForm {
  cuit: string;
  certificate: string;
  privateKey: string;
  environment: AfipEnvironment;
}

interface AfipSyncState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

interface AfipConfigContextValue {
  config: AfipConfig | null;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  loadAfipConfig: () => Promise<void>;
  updateAfipConfig: (input: AfipConfigForm) => Promise<boolean>;
}

const noop = async () => {};

const DEFAULT_SYNC_STATE: AfipSyncState = {
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,
};

const AFIP_SETTINGS_ENDPOINT_CANDIDATES = [
  '/afip/settings',
  '/afip/configuration',
  '/billing/afip/settings',
];

export const AfipConfigContext = createContext<AfipConfigContextValue>({
  config: null,
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,
  loadAfipConfig: noop,
  updateAfipConfig: async () => false,
});

const normaliseHeaders = (input?: HeadersInit): Record<string, string> => {
  if (!input) {
    return {};
  }
  if (input instanceof Headers) {
    return Object.fromEntries(input.entries());
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input);
  }
  return { ...input };
};

const sanitiseCuit = (value: string): string => value.replace(/[^0-9]/g, '');

const serialiseAfipPayload = (form: AfipConfigForm) => ({
  cuit: sanitiseCuit(form.cuit ?? ''),
  certificate: (form.certificate ?? '').trim(),
  private_key: (form.privateKey ?? '').trim(),
  environment: form.environment ?? 'homologacion',
});

const toAfipConfig = (payload: unknown): AfipConfig | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const cuitSource = record['cuit'] ?? record['tax_id'] ?? record['afip_cuit'];
  const cuit = typeof cuitSource === 'string' ? sanitiseCuit(cuitSource) : '';

  const certificateSource =
    record['certificate'] ?? record['cert'] ?? record['afip_certificate'] ?? record['certificado'];
  const certificate = typeof certificateSource === 'string' ? certificateSource : '';

  const privateKeySource =
    record['private_key'] ?? record['privateKey'] ?? record['key'] ?? record['clave'] ?? '';
  const privateKey = typeof privateKeySource === 'string' ? privateKeySource : '';

  const environmentSource = record['environment'] ?? record['mode'] ?? record['ambiente'];
  const environment =
    typeof environmentSource === 'string'
      ? (environmentSource.toLowerCase() as AfipEnvironment)
      : ('homologacion' as AfipEnvironment);

  const lastSyncedSource =
    record['last_synced_at'] ?? record['synced_at'] ?? record['last_sync_at'] ?? record['updated_at'];
  const lastSyncedAt = typeof lastSyncedSource === 'string' ? lastSyncedSource : null;

  const updatedAtSource = record['updated_at'] ?? record['updatedAt'];
  const updatedAt = typeof updatedAtSource === 'string' ? updatedAtSource : undefined;

  return {
    cuit,
    certificate,
    privateKey,
    environment,
    lastSyncedAt,
    updatedAt: updatedAt ?? lastSyncedAt ?? undefined,
  };
};

export const AfipConfigProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [config, setConfig] = useCachedState<AfipConfig | null>('afip-config', null);
  const [syncState, setSyncState] = useCachedState<AfipSyncState>('afip-config-sync', DEFAULT_SYNC_STATE);
  const resolvedEndpointRef = useRef<string | null>(null);

  const performAfipRequest = useCallback(
    async (buildPath: (basePath: string) => string, init?: RequestInit) => {
      if (!token) {
        throw new Error('Token no disponible para configuración AFIP');
      }

      const baseHeaders = normaliseHeaders(init?.headers);
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...baseHeaders,
      };

      if (init?.body && !('Content-Type' in headers)) {
        headers['Content-Type'] = 'application/json';
      }

      const candidates = resolvedEndpointRef.current
        ? [
            resolvedEndpointRef.current,
            ...AFIP_SETTINGS_ENDPOINT_CANDIDATES.filter(
              candidate => candidate !== resolvedEndpointRef.current
            ),
          ]
        : AFIP_SETTINGS_ENDPOINT_CANDIDATES;

      let last404Path: string | null = null;
      let last404Status: number | null = null;

      for (const basePath of candidates) {
        const path = buildPath(basePath);
        const response = await fetch(`${BASE_URL}${path}`, {
          ...init,
          headers,
        });

        if (response.status === 404) {
          last404Path = path;
          last404Status = response.status;
          continue;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${path} ${text}`);
        }

        resolvedEndpointRef.current = basePath;
        return response;
      }

      const detail = last404Path ? `${last404Status} en ${last404Path}` : 'sin respuesta válida';
      throw new Error(`No se pudo resolver el endpoint de configuración AFIP (${detail}).`);
    },
    [token]
  );

  const loadAfipConfig = useCallback(async () => {
    if (!token) {
      return;
    }

    setSyncState(prev => ({ ...prev, isSyncing: true, lastError: null }));

    try {
      const response = await performAfipRequest(basePath => `${basePath}`);
      const data = await response.json().catch(() => ({}));
      const parsed = toAfipConfig(data);
      if (parsed) {
        setConfig(parsed);
        setSyncState(prev => ({ ...prev, lastSyncedAt: parsed.lastSyncedAt ?? new Date().toISOString() }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setSyncState(prev => ({ ...prev, lastError: message }));
      console.error('Error al cargar configuración AFIP:', error);
    } finally {
      setSyncState(prev => ({ ...prev, isSyncing: false }));
    }
  }, [performAfipRequest, setConfig, setSyncState, token]);

  const updateAfipConfig = useCallback(
    async (input: AfipConfigForm) => {
      if (!token) {
        Alert.alert('Sesión no disponible', 'Inicia sesión nuevamente para actualizar la configuración.');
        return false;
      }

      setSyncState(prev => ({ ...prev, isSyncing: true, lastError: null }));

      try {
        const response = await performAfipRequest(
          basePath => `${basePath}`,
          {
            method: 'PUT',
            body: JSON.stringify(serialiseAfipPayload(input)),
          }
        );

        const data = await response.json().catch(() => ({}));
        const parsed = toAfipConfig(data);

        if (parsed) {
          setConfig(parsed);
          setSyncState(prev => ({ ...prev, lastSyncedAt: parsed.lastSyncedAt ?? new Date().toISOString() }));
        } else {
          setSyncState(prev => ({ ...prev, lastSyncedAt: new Date().toISOString() }));
        }

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setSyncState(prev => ({ ...prev, lastError: message }));
        Alert.alert('Error', message);
        console.error('Error al actualizar configuración AFIP:', error);
        return false;
      } finally {
        setSyncState(prev => ({ ...prev, isSyncing: false }));
      }
    },
    [performAfipRequest, setConfig, setSyncState, token]
  );

  const value = useMemo(
    () => ({
      config,
      isSyncing: syncState.isSyncing,
      lastSyncedAt: syncState.lastSyncedAt,
      lastError: syncState.lastError,
      loadAfipConfig,
      updateAfipConfig,
    }),
    [config, loadAfipConfig, syncState.isSyncing, syncState.lastError, syncState.lastSyncedAt, updateAfipConfig]
  );

  return <AfipConfigContext.Provider value={value}>{children}</AfipConfigContext.Provider>;
};
