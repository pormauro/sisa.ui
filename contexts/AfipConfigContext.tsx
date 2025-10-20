// /contexts/AfipConfigContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

export type AfipEnvironment = 'homologation' | 'production' | string;

export interface AfipConfig {
  cuit: string;
  certificate: string;
  privateKey: string;
  environment: AfipEnvironment;
  certificateName?: string | null;
  lastSyncedAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface AfipConfigInput {
  cuit: string;
  certificate: string;
  privateKey: string;
  environment: AfipEnvironment;
}

interface AfipConfigContextValue {
  config: AfipConfig | null;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedAt: string | null;
  loadAfipConfig: () => Promise<void>;
  updateAfipConfig: (input: AfipConfigInput) => Promise<boolean>;
}

const noop = async () => {};

const AFIP_CONFIG_ENDPOINT_CANDIDATES = [
  '/afip/settings',
  '/afip/configuration',
  '/settings/afip',
];

export const AfipConfigContext = createContext<AfipConfigContextValue>({
  config: null,
  isSyncing: false,
  syncError: null,
  lastSyncedAt: null,
  loadAfipConfig: noop,
  updateAfipConfig: async () => false,
});

const normaliseString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
};

const normaliseCuit = (value: unknown): string => {
  const raw = normaliseString(value) ?? '';
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.slice(0, 11);
};

const detectEnvironment = (record: Record<string, unknown>): AfipEnvironment => {
  const envCandidates = [
    record['environment'],
    record['environment_mode'],
    record['mode'],
    record['afip_environment'],
    record['afip_mode'],
  ];

  for (const candidate of envCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate as AfipEnvironment;
    }
  }

  const homologationCandidates = [
    record['homologation'],
    record['is_homologation'],
    record['is_test_mode'],
  ];

  for (const candidate of homologationCandidates) {
    if (candidate === true) {
      return 'homologation';
    }
    if (candidate === false) {
      return 'production';
    }
  }

  return 'homologation';
};

const pickLastSyncedAt = (record: Record<string, unknown>): string | null => {
  const candidates = [
    record['last_synced_at'],
    record['lastSyncAt'],
    record['synced_at'],
    record['updated_at'],
    record['updatedAt'],
  ];

  for (const candidate of candidates) {
    const value = normaliseString(candidate);
    if (!value) {
      continue;
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
};

const toAfipConfig = (payload: unknown): AfipConfig | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const cuit = normaliseCuit(record['cuit'] ?? record['afip_cuit']);
  const certificate =
    normaliseString(record['certificate']) ??
    normaliseString(record['certificate_content']) ??
    normaliseString(record['afip_certificate']) ??
    '';
  const privateKey =
    normaliseString(record['private_key']) ??
    normaliseString(record['afip_private_key']) ??
    normaliseString(record['privateKey']) ??
    '';

  const environment = detectEnvironment(record);
  const certificateName =
    normaliseString(record['certificate_name']) ??
    normaliseString(record['certificate_filename']) ??
    normaliseString(record['certificateFileName']) ??
    null;
  const lastSyncedAt = pickLastSyncedAt(record);

  return {
    cuit,
    certificate,
    privateKey,
    environment,
    certificateName,
    lastSyncedAt,
    updatedAt: lastSyncedAt,
    ...record,
  };
};

const serialiseConfigInput = (input: AfipConfigInput): Record<string, unknown> => {
  return {
    cuit: normaliseCuit(input.cuit),
    certificate: input.certificate.trim(),
    private_key: input.privateKey.trim(),
    environment: input.environment,
  };
};

export const AfipConfigProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [config, setConfig] = useCachedState<AfipConfig | null>('afip-config', null);
  const [lastSyncedAt, setLastSyncedAt] = useCachedState<string | null>(
    'afip-config-last-sync',
    null
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const resolvedEndpointRef = useRef<string | null>(null);

  const normaliseHeaders = useCallback((input?: HeadersInit): Record<string, string> => {
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
  }, []);

  const performAfipConfigRequest = useCallback(
    async (init?: RequestInit) => {
      if (!token) {
        throw new Error('Token no disponible para configuración AFIP');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const candidates = resolvedEndpointRef.current
        ? [
            resolvedEndpointRef.current,
            ...AFIP_CONFIG_ENDPOINT_CANDIDATES.filter(
              candidate => candidate !== resolvedEndpointRef.current
            ),
          ]
        : AFIP_CONFIG_ENDPOINT_CANDIDATES;

      let last404Path: string | null = null;
      let last404Status: number | null = null;

      for (const basePath of candidates) {
        const url = `${BASE_URL}${basePath}`;
        const response = await fetch(url, {
          ...init,
          headers: { ...headers, ...normaliseHeaders(init?.headers) },
        });

        if (response.status === 404) {
          last404Path = basePath;
          last404Status = response.status;
          continue;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${basePath} ${text}`);
        }

        resolvedEndpointRef.current = basePath;
        return response;
      }

      const detail = last404Path ? `${last404Status} en ${last404Path}` : 'sin respuesta válida';
      throw new Error(`No se pudo resolver el endpoint de configuración AFIP (${detail}).`);
    },
    [normaliseHeaders, token]
  );

  const loadAfipConfig = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const response = await performAfipConfigRequest();
      const data = await response.json().catch(() => ({}));
      const parsed = toAfipConfig(data);
      if (parsed) {
        setConfig(parsed);
        const syncValue = parsed.lastSyncedAt ?? new Date().toISOString();
        setLastSyncedAt(syncValue);
      }
    } catch (error) {
      console.error('Error loading AFIP config:', error);
      setSyncError(error instanceof Error ? error.message : 'Error desconocido al cargar');
    } finally {
      setIsSyncing(false);
    }
  }, [performAfipConfigRequest, setConfig, setLastSyncedAt, token]);

  const updateAfipConfig = useCallback(
    async (input: AfipConfigInput): Promise<boolean> => {
      if (!token) {
        Alert.alert('Sesión requerida', 'Debes iniciar sesión para actualizar la configuración.');
        return false;
      }

      setIsSyncing(true);
      setSyncError(null);

      try {
        const body = JSON.stringify(serialiseConfigInput(input));
        const response = await performAfipConfigRequest({
          method: 'PUT',
          body,
        });

        const payload = await response.json().catch(() => ({}));
        const parsed = toAfipConfig(payload) ?? {
          ...input,
          certificate: input.certificate,
          privateKey: input.privateKey,
          environment: input.environment,
        };

        setConfig(prev => ({ ...prev, ...parsed }));
        const syncValue = parsed.lastSyncedAt ?? new Date().toISOString();
        setLastSyncedAt(syncValue);

        return true;
      } catch (error) {
        console.error('Error updating AFIP config:', error);
        const message =
          error instanceof Error ? error.message : 'Error desconocido al actualizar la configuración AFIP.';
        setSyncError(message);
        Alert.alert('Error', message);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [performAfipConfigRequest, setConfig, setLastSyncedAt, token]
  );

  useEffect(() => {
    if (token) {
      void loadAfipConfig();
    }
  }, [loadAfipConfig, token]);

  const contextValue = useMemo(
    () => ({ config, isSyncing, syncError, lastSyncedAt, loadAfipConfig, updateAfipConfig }),
    [config, isSyncing, syncError, lastSyncedAt, loadAfipConfig, updateAfipConfig]
  );

  return <AfipConfigContext.Provider value={contextValue}>{children}</AfipConfigContext.Provider>;
};
