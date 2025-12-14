import React, { createContext, useEffect, useContext, useCallback, useState, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';
import { subscribeToDataCacheClear } from '@/utils/cache';
import { MemberCompaniesContext } from '@/contexts/MemberCompaniesContext';

interface PermissionsContextProps {
  permissions: string[]; // Array de cadenas con los nombres de los permisos
  loading: boolean;
  refreshPermissions: () => Promise<void>;
  isCompanyAdmin: boolean;
}

const PERMISSION_ALIASES: Record<string, string[]> = {
};

const ALL_PERMISSIONS: string[] = [
  'addAppointment',
  'addCashBox',
  'addCategory',
  'addClient',
  'addFolder',
  'addInvoice',
  'addJob',
  'addPayment',
  'addPaymentTemplate',
  'addProductService',
  'addProvider',
  'addReceipt',
  'addStatus',
  'addTariff',
  'createCompany',
  'deleteAppointment',
  'deleteCashBox',
  'deleteCategory',
  'deleteClient',
  'deleteCompany',
  'deleteFolder',
  'deleteInvoice',
  'deleteJob',
  'deletePayment',
  'deletePaymentTemplate',
  'deleteProductService',
  'deleteProvider',
  'deleteReceipt',
  'deleteReport',
  'deleteStatus',
  'deleteTariff',
  'downloadInvoicePdf',
  'generatePaymentReport',
  'listAppUpdates',
  'listAppointments',
  'listCashBoxes',
  'listCategories',
  'listCompanies',
  'listFolders',
  'listInvoices',
  'listJobs',
  'listNotifications',
  'listPaymentTemplates',
  'listPayments',
  'listProductsServices',
  'listProviders',
  'listReceipts',
  'listReports',
  'listStatuses',
  'listTariffs',
  'markAllNotificationsRead',
  'updateAppointment',
  'updateCashBox',
  'updateCategory',
  'updateClient',
  'updateCompany',
  'updateFolder',
  'updateInvoice',
  'updateJob',
  'updatePayment',
  'updatePaymentTemplate',
  'updateProductService',
  'updateProvider',
  'updateReceipt',
  'updateStatus',
  'updateTariff',
  'usePaymentTemplateShortcuts',
];

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
  isCompanyAdmin: false,
});

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, userId, isLoading: authIsLoading, checkConnection } = useContext(AuthContext);
  const { memberships } = useContext(MemberCompaniesContext);
  const [permissions, setPermissions, permissionsHydrated] = useCachedState<string[]>(
    'permissions',
    []
  );
  const [selectedCompanyId, , selectedCompanyHydrated] = useCachedState<number | null>(
    'selected-company-id',
    null,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [isCompanyAdmin, setIsCompanyAdmin] = useState<boolean>(false);
  const previousUserIdRef = useRef<string | null>(null);
  const previousCompanyIdRef = useRef<number | null>(null);

  const selectedMembership = useMemo(
    () => memberships.find(record => record.companyId === selectedCompanyId) ?? null,
    [memberships, selectedCompanyId]
  );

  const hasPrivilegedRole = useMemo(() => {
    const normalizedRole = selectedMembership?.role?.trim().toLowerCase();
    return normalizedRole === 'admin' || normalizedRole === 'owner' || normalizedRole === 'dueño' || normalizedRole === 'dueno';
  }, [selectedMembership?.role]);

  const hasFullCompanyAccess = userId === '1' || hasPrivilegedRole;

  const replacePermissionsIfNeeded = useCallback(
    (nextPermissions: string[]) => {
      setPermissions(prev => {
        if (prev.length === nextPermissions.length && prev.every(value => nextPermissions.includes(value))) {
          return prev;
        }
        return nextPermissions;
      });
    },
    [setPermissions],
  );

  const clearCachedPermissions = useCallback(() => {
    setPermissions(prev => (prev.length > 0 ? [] : prev));
  }, [setPermissions]);

  useEffect(() => {
    if (!permissionsHydrated) {
      return;
    }

    if (!authIsLoading && !userId) {
      clearCachedPermissions();
      setIsCompanyAdmin(false);
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

  useEffect(() => {
    if (!selectedCompanyHydrated) {
      return;
    }

    const previousCompanyId = previousCompanyIdRef.current;
    if (previousCompanyId !== null && previousCompanyId !== selectedCompanyId && !hasFullCompanyAccess) {
      clearCachedPermissions();
      setIsCompanyAdmin(false);
    }

    previousCompanyIdRef.current = selectedCompanyId ?? null;
  }, [clearCachedPermissions, hasFullCompanyAccess, selectedCompanyHydrated, selectedCompanyId]);

  const fetchPermissions = useCallback(async () => {
    // Si no hay token o userId disponible, conservamos la información en caché.
    if (hasFullCompanyAccess) {
      replacePermissionsIfNeeded(ALL_PERMISSIONS);
      setIsCompanyAdmin(true);
      return;
    }

    if (!token || !userId || !selectedCompanyHydrated) {
      return;
    }
    setLoading(true);
    try {
      const companyIdParam = selectedCompanyId ?? 'null';

      const parsePermissionsResponse = async (
        response: Response,
        scope: 'usuario' | 'global'
      ) => {
        if (!response.ok) {
          let errorDetail = '';
          let errorPayload: any = null;
          try {
            const errorText = await response.text();
            errorDetail = errorText ? `: ${errorText}` : '';
            if (errorText) {
              try {
                errorPayload = JSON.parse(errorText);
              } catch {
                // Si la respuesta no es JSON ignoramos el error.
              }
            }
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
          const error: Error & {
            status?: number;
            scope?: string;
            tokenMismatch?: boolean;
          } = new Error(
            `HTTP ${response.status} al cargar permisos ${scope}${errorDetail}`
          );
          error.status = response.status;
          error.scope = scope;
          const errorMessage =
            (typeof errorPayload?.error === 'string' && errorPayload.error) ||
            (typeof errorPayload?.message === 'string' && errorPayload.message) ||
            '';
          if (errorMessage.toLowerCase().includes('el token no coincide')) {
            error.tokenMismatch = true;
          }
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
        fetch(`${BASE_URL}/permissions/user/${userId}?company_id=${companyIdParam}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(response => parsePermissionsResponse(response, 'usuario')),
        fetch(`${BASE_URL}/permissions/global?company_id=${companyIdParam}`, {
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
      replacePermissionsIfNeeded(expandWithAliases(mergedPermissions));

      const normalizeBooleanCandidate = (candidate: any): boolean | undefined => {
        if (typeof candidate === 'boolean') {
          return candidate;
        }

        if (typeof candidate === 'string') {
          const normalized = candidate.trim().toLowerCase();
          if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) {
            return true;
          }
          if (['false', '0', 'no'].includes(normalized)) {
            return false;
          }
        }

        if (typeof candidate === 'number') {
          if (candidate === 1) return true;
          if (candidate === 0) return false;
        }

        return undefined;
      };

      const deriveIsCompanyAdmin = (...candidates: any[]): boolean => {
        for (const candidate of candidates) {
          const normalized = normalizeBooleanCandidate(candidate);
          if (typeof normalized === 'boolean') {
            return normalized;
          }
        }
        return false;
      };

      const adminFlag = deriveIsCompanyAdmin(
        userData?.is_company_admin,
        userData?.isCompanyAdmin,
        userData?.company_admin,
        userData?.is_admin,
        globalData?.is_company_admin,
        globalData?.isCompanyAdmin,
        globalData?.company_admin,
        globalData?.is_admin,
      );
      setIsCompanyAdmin(adminFlag || hasPrivilegedRole);
    } catch (error: any) {
      console.error('Error fetching permissions', error);
      const status = typeof error?.status === 'number' ? error.status : undefined;
      const tokenMismatch = Boolean(error?.tokenMismatch);
      if (tokenMismatch) {
        // El backend indica que el token no coincide con el registrado.
        // Solicitamos la verificación de la sesión para obtener un nuevo token
        // y evitamos mostrar una alerta para que el proceso sea transparente.
        try {
          await checkConnection();
        } catch (revalidationError) {
          console.log('No fue posible obtener un nuevo token tras la desincronización.', revalidationError);
        }
        return;
      }
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
  }, [
    checkConnection,
    hasFullCompanyAccess,
    hasPrivilegedRole,
    replacePermissionsIfNeeded,
    selectedCompanyHydrated,
    selectedCompanyId,
    token,
    userId,
  ]);

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

  useEffect(() => {
    const unsubscribe = subscribeToDataCacheClear(() => {
      void fetchPermissions();
    });
    return unsubscribe;
  }, [fetchPermissions]);

  return (
    <PermissionsContext.Provider
      value={{ permissions, loading, refreshPermissions: fetchPermissions, isCompanyAdmin }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};
