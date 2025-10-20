import React, { createContext, useEffect, useContext, useCallback, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';

interface PermissionsContextProps {
  permissions: string[]; // Array de cadenas con los nombres de los permisos
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

const PERMISSION_ALIASES: Record<string, string[]> = {
  listFeedbacks: ['listComments'],
  addFeedback: ['addComment'],
  respondFeedback: ['respondComment'],
  listComments: ['listFeedbacks'],
  addComment: ['addFeedback'],
  respondComment: ['respondFeedback'],
};

const expandWithAliases = (values: string[]): string[] => {
  const set = new Set(values);
  values.forEach(value => {
    const aliases = PERMISSION_ALIASES[value];
    if (aliases) {
      aliases.forEach(alias => set.add(alias));
    }
  });
  return Array.from(set);
};

export const PermissionsContext = createContext<PermissionsContextProps>({
  permissions: [],
  loading: false,
  refreshPermissions: async () => {},
});

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, userId, isLoading: authIsLoading, checkConnection } = useContext(AuthContext);
  const [permissions, setPermissions, permissionsHydrated] = useCachedState<string[]>(
    'permissions',
    []
  );
  const [loading, setLoading] = useState<boolean>(false);
  const previousUserIdRef = useRef<string | null>(null);

  const clearCachedPermissions = useCallback(() => {
    setPermissions(prev => (prev.length > 0 ? [] : prev));
  }, [setPermissions]);

  useEffect(() => {
    if (!permissionsHydrated) {
      return;
    }

    if (!authIsLoading && !userId) {
      clearCachedPermissions();
      previousUserIdRef.current = null;
      return;
    }

    if (userId && previousUserIdRef.current && previousUserIdRef.current !== userId) {
      clearCachedPermissions();
    }

    if (userId !== previousUserIdRef.current) {
      previousUserIdRef.current = userId ?? null;
    }
  }, [authIsLoading, clearCachedPermissions, permissionsHydrated, userId]);

  const fetchPermissions = useCallback(async () => {
    // Si no hay token o userId disponible, conservamos la información en caché.
    if (!token || !userId) {
      return;
    }
    setLoading(true);
    try {
      const parsePermissionsResponse = async (
        response: Response,
        scope: 'usuario' | 'global'
      ) => {
        if (!response.ok) {
          let errorDetail = '';
          try {
            const errorText = await response.text();
            errorDetail = errorText ? `: ${errorText}` : '';
          } catch {
            // Ignoramos errores al leer el cuerpo para no enmascarar la causa original.
          }
          const authorizationError = response.status === 401 || response.status === 403;
          if (authorizationError) {
            try {
              await checkConnection();
            } catch (checkError) {
              console.log(
                `No fue posible revalidar la sesión tras un ${response.status}.`,
                checkError
              );
            }
          }
          const error: Error & { status?: number; scope?: string } = new Error(
            `HTTP ${response.status} al cargar permisos ${scope}${errorDetail}`
          );
          error.status = response.status;
          error.scope = scope;
          throw error;
        }

        try {
          return await response.json();
        } catch (jsonError) {
          throw new Error(`Respuesta inválida al cargar permisos ${scope}: ${String(jsonError)}`);
        }
      };

      // Se realizan ambas peticiones de forma concurrente:
      const [userData, globalData] = await Promise.all([
        fetch(`${BASE_URL}/permissions/user/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(response => parsePermissionsResponse(response, 'usuario')),
        fetch(`${BASE_URL}/permissions/global`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(response => parsePermissionsResponse(response, 'global')),
      ]);

      // Suponemos que la respuesta tiene la forma: { permissions: [ { id, sector, ... }, ... ] }
      const userPerms: string[] = userData.permissions?.map((p: any) => p.sector) || [];
      const globalPerms: string[] = globalData.permissions?.map((p: any) => p.sector) || [];

      // Unir ambas listas sin duplicados
      const mergedPermissions = Array.from(new Set([...userPerms, ...globalPerms]));
      setPermissions(expandWithAliases(mergedPermissions));
    } catch (error: any) {
      console.error('Error fetching permissions', error);
      const status = typeof error?.status === 'number' ? error.status : undefined;
      if (status === 401 || status === 403) {
        Alert.alert(
          'Sesión no válida',
          'Detectamos un problema con tu sesión. Mantendremos los últimos permisos hasta que vuelvas a iniciar sesión.'
        );
      } else {
        Alert.alert(
          'Error',
          'No se pudieron cargar los permisos actuales. Se conservarán los últimos permisos válidos.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [checkConnection, setPermissions, token, userId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Refrescar periódicamente cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPermissions();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPermissions]);

  return (
    <PermissionsContext.Provider value={{ permissions, loading, refreshPermissions: fetchPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
};
