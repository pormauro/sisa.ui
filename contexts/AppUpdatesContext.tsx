import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { APP_VERSION, BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCachedState } from '@/hooks/useCachedState';

interface LatestAppUpdate {
  version_code: string;
  release_date: string;
  download_url: string;
  change_log?: string | null;
}

interface AppUpdatesContextProps {
  latestUpdate: LatestAppUpdate | null;
  updateAvailable: boolean;
  isChecking: boolean;
  lastCheckedAt: string | null;
  currentVersion: string;
  refreshLatestUpdate: () => Promise<void>;
}

const defaultContext: AppUpdatesContextProps = {
  latestUpdate: null,
  updateAvailable: false,
  isChecking: false,
  lastCheckedAt: null,
  currentVersion: '0.0.0',
  refreshLatestUpdate: async () => {},
};

const isVersionNewer = (candidate: string, current: string): boolean => {
  const parse = (value: string) => value.split('.').map(part => Number(part) || 0);
  const candidateParts = parse(candidate);
  const currentParts = parse(current);
  const maxLength = Math.max(candidateParts.length, currentParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const candidateValue = candidateParts[index] ?? 0;
    const currentValue = currentParts[index] ?? 0;

    if (candidateValue > currentValue) return true;
    if (candidateValue < currentValue) return false;
  }

  return false;
};

export const AppUpdatesContext = createContext<AppUpdatesContextProps>(defaultContext);

export const AppUpdatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [latestUpdate, setLatestUpdate, latestHydrated] = useCachedState<LatestAppUpdate | null>(
    'appUpdates.latestUpdate',
    null
  );
  const [lastCheckedAt, setLastCheckedAt] = useCachedState<string | null>(
    'appUpdates.lastCheckedAt',
    null
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const { token, checkConnection } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  const currentVersion = APP_VERSION;

  const updateAvailable = useMemo(
    () => (latestUpdate ? isVersionNewer(latestUpdate.version_code, currentVersion) : false),
    [currentVersion, latestUpdate]
  );

  const refreshLatestUpdate = useCallback(async (): Promise<void> => {
    if (!token || !permissions.includes('listAppUpdates')) {
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch(
        `${BASE_URL}/app_updates/latest?current_version=${encodeURIComponent(currentVersion)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          try {
            await checkConnection();
          } catch (error) {
            console.log('No se pudo revalidar la sesión al verificar actualizaciones.', error);
          }
        }
        const errorBody = await response.text();
        const reason = errorBody ? ` Detalle: ${errorBody}` : '';
        console.log(`No se pudo obtener la última versión (HTTP ${response.status}).${reason}`);
        return;
      }

      const payload = await response.json();
      const latest = payload?.latest
        ? {
            version_code: payload.latest.version_code,
            release_date: payload.latest.release_date,
            download_url: payload.latest.download_url,
            change_log: payload.latest.change_log ?? null,
          }
        : null;

      setLatestUpdate(latest);
      setLastCheckedAt(new Date().toISOString());
    } catch (error: any) {
      console.log('Error buscando actualizaciones de la app:', error);
      Alert.alert(
        'Sin conexión',
        'No pudimos verificar si hay una nueva versión disponible. Usaremos la información en caché.'
      );
    } finally {
      setIsChecking(false);
    }
  }, [checkConnection, currentVersion, permissions, setLastCheckedAt, setLatestUpdate, token]);

  useEffect(() => {
    if (token && latestHydrated) {
      void refreshLatestUpdate();
    }
  }, [latestHydrated, refreshLatestUpdate, token]);

  return (
    <AppUpdatesContext.Provider
      value={{ latestUpdate, updateAvailable, isChecking, lastCheckedAt, currentVersion, refreshLatestUpdate }}
    >
      {children}
    </AppUpdatesContext.Provider>
  );
};
