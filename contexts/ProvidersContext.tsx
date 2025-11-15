// /contexts/ProvidersContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';
import {
  CompanySummary,
  coerceToNumber,
  getCompanyDisplayName,
  normalizeNullableStringValue,
  normalizeOptionalStringValue,
  parseCompanySummary,
} from '@/utils/companySummary';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { normalizeTaxId } from '@/utils/tax';

export interface Provider {
  id: number;
  business_name: string;
  tax_id: string;
  email: string;
  profile_file_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  company_id: number | null;
  company: CompanySummary | null;
}

type ProviderApiResponse = {
  id: number | string;
  empresa_id?: number | string;
  profile_file_id?: number | string | null;
  created_at?: string;
  updated_at?: string;
  company?: Record<string, any> | null;
  business_name?: string | null;
  tax_id?: string | number | null;
  email?: string | null;
};

export interface ProviderPayload {
  company_id: number;
}

export type ProviderUpdatePayload = Partial<ProviderPayload>;

interface ProvidersContextValue {
  providers: Provider[];
  loadProviders: () => void;
  addProvider: (provider: ProviderPayload) => Promise<number | null>;
  updateProvider: (id: number, provider: ProviderUpdatePayload) => Promise<boolean>;
  deleteProvider: (id: number) => Promise<boolean>;
}

export const ProvidersContext = createContext<ProvidersContextValue>({
  providers: [],
  loadProviders: () => {},
  addProvider: async () => null,
  updateProvider: async () => false,
  deleteProvider: async () => false,
});

export const ProvidersProvider = ({ children }: { children: ReactNode }) => {
  const [providers, setProviders] = useCachedState<Provider[]>(
    'providers',
    []
  );
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setProviders(prev =>
      ensureSortedByNewest(
        prev.map(provider => {
          const legacy = provider as Provider & { brand_file_id?: string | null };
          const normalizedProfileId = (() => {
            if (legacy.profile_file_id) {
              return legacy.profile_file_id;
            }
            if (typeof legacy.brand_file_id === 'string') {
              const trimmed = legacy.brand_file_id.trim();
              return trimmed.length ? trimmed : null;
            }
            return null;
          })();

          return {
            ...provider,
            profile_file_id: normalizedProfileId,
            tax_id: normalizeTaxId(provider.tax_id),
          };
        }),
        getDefaultSortValue
      )
    );
  }, [setProviders]);

  const loadProviders = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/providers`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = await response.json();
      if (data.providers) {
        const fetchedProviders = (data.providers as ProviderApiResponse[]).map(provider => {
          const company = parseCompanySummary(provider.company);
          const profileFileId =
            company?.profile_file_id ?? normalizeNullableStringValue(provider.profile_file_id);

          return {
            id: coerceToNumber(provider.id) ?? 0,
            business_name:
              getCompanyDisplayName(company) || normalizeOptionalStringValue(provider.business_name),
            tax_id: normalizeTaxId(company?.tax_id ?? provider.tax_id),
            email: company?.email ?? normalizeOptionalStringValue(provider.email),
            profile_file_id: profileFileId,
            created_at: provider.created_at ?? null,
            updated_at: provider.updated_at ?? null,
            company_id: company?.id ?? coerceToNumber(provider.empresa_id),
            company,
          } as Provider;
        });
        setProviders(sortByNewest(fetchedProviders, getDefaultSortValue));
      }
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar proveedores, se solicitará uno nuevo.');
        return;
      }
      console.error('Error loading providers:', error);
    }
  }, [setProviders, token]);

  const addProvider = useCallback(
    async (providerData: ProviderPayload): Promise<number | null> => {
      const body = {
        company_id: providerData.company_id,
      };
      try {
        const response = await fetch(`${BASE_URL}/providers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        if (data.provider_id) {
          await loadProviders();
          return parseInt(data.provider_id, 10);
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al agregar proveedor, se solicitará uno nuevo.');
          return null;
        }
        console.error('Error adding provider:', error);
      }
      return null;
    },
    [loadProviders, token]
  );

  const updateProvider = useCallback(
    async (id: number, provider: ProviderUpdatePayload): Promise<boolean> => {
      const body: Record<string, unknown> = {};
      if (typeof provider.company_id === 'number') {
        body.company_id = provider.company_id;
      }
      try {
        const response = await fetch(`${BASE_URL}/providers/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        await ensureAuthResponse(response);
        if (response.ok) {
          await loadProviders();
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al actualizar proveedor, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error updating provider:', error);
      }
      return false;
    },
    [loadProviders, token]
  );

  const deleteProvider = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${BASE_URL}/providers/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        if (data.message === 'Provider deleted successfully') {
          setProviders(prev => prev.filter(p => p.id !== id));
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al eliminar proveedor, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error deleting provider:', error);
      }
      return false;
    },
    [setProviders, token]
  );

  useEffect(() => {
    if (token) {
      loadProviders();
    }
  }, [loadProviders, token]);

  return (
    <ProvidersContext.Provider
      value={{
        providers,
        loadProviders,
        addProvider,
        updateProvider,
        deleteProvider,
      }}
    >
      {children}
    </ProvidersContext.Provider>
  );
};

