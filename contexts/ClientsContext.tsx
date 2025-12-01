import React, {
  createContext,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';
import { toNumericValue } from '@/utils/currency';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { retryOnTokenExpiration } from '@/utils/auth/retry';
import {
  CompanySummary,
  coerceToNumber,
  getCompanyDisplayName,
  normalizeNullableStringValue,
  normalizeOptionalStringValue,
  parseCompanySummary,
} from '@/utils/companySummary';
import { normalizeTaxId } from '@/utils/tax';

export type ClientCompanySummary = CompanySummary;

export interface Client {
  id: number;
  business_name: string;
  tax_id: string;
  email: string;
  profile_file_id: string | null;
  tariff_id: number | null;
  company_id: number | null;
  company: ClientCompanySummary | null;
  unbilled_total?: number;
  unpaid_invoices_total?: number;
  created_at?: string;
  updated_at?: string;
}

type ClientApiResponse = {
  id: number | string;
  user_id?: number | string;
  empresa_id?: number | string;
  profile_file_id?: number | string | null;
  tariff_id?: number | string | null;
  created_at?: string;
  updated_at?: string;
  company?: Record<string, any> | null;
  business_name?: string | null;
  tax_id?: string | number | null;
  email?: string | null;
  finalized_jobs_total?: number | string | null;
  unbilled_total?: number | string | null;
  unpaid_invoices_total?: number | string | null;
};

export interface ClientPayload {
  company_id: number;
  tariff_id?: number | null;
}

export type ClientUpdatePayload = Partial<ClientPayload>;

interface ClientsContextValue {
  clients: Client[];
  loadClients: () => void;
  addClient: (client: ClientPayload) => Promise<number | null>;
  updateClient: (id: number, client: ClientUpdatePayload) => Promise<boolean>;
  deleteClient: (id: number) => Promise<boolean>;
}

export const ClientsContext = createContext<ClientsContextValue>({
  clients: [],
  loadClients: () => {},
  addClient: async () => null,
  updateClient: async () => false,
  deleteClient: async () => false,
});

export const ClientsProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useCachedState<Client[]>('clients', []);
  const { token, checkConnection } = useContext(AuthContext);

  const runWithAuthRetry = useCallback(
    async <T>(operation: () => Promise<T>) =>
      retryOnTokenExpiration(operation, { onUnauthorized: () => checkConnection(true) }),
    [checkConnection]
  );

  useEffect(() => {
    setClients(prev =>
      ensureSortedByNewest(
        prev.map(client => {
          const legacy = client as Client & { brand_file_id?: string | null };
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
            ...client,
            profile_file_id: normalizedProfileId,
            tax_id: normalizeTaxId(client.tax_id),
          };
        }),
        getDefaultSortValue
      )
    );
  }, [setClients]);

  const loadClients = useCallback(async () => {
    const fetchClients = async () => {
      const res = await fetch(`${BASE_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await ensureAuthResponse(res);
      const data = await res.json();
      if (Array.isArray(data.clients)) {
        const fetchedClients = (data.clients as ClientApiResponse[]).map(client => {
          const company = parseCompanySummary(client.company);
          const companyId = company?.id ?? coerceToNumber(client.empresa_id);
          const profileFileId =
            company?.profile_file_id ?? normalizeNullableStringValue(client.profile_file_id);

          return {
            id: coerceToNumber(client.id) ?? 0,
            business_name:
              getCompanyDisplayName(company) || normalizeOptionalStringValue(client.business_name),
            tax_id: normalizeTaxId(company?.tax_id ?? client.tax_id),
            email: company?.email ?? normalizeOptionalStringValue(client.email),
            profile_file_id: profileFileId,
            tariff_id: coerceToNumber(client.tariff_id),
            company_id: companyId,
            company: company,
            unbilled_total: toNumericValue(client.finalized_jobs_total ?? client.unbilled_total),
            unpaid_invoices_total: toNumericValue(client.unpaid_invoices_total),
            created_at: client.created_at,
            updated_at: client.updated_at,
          } as Client;
        });
        setClients(sortByNewest(fetchedClients, getDefaultSortValue));
      }
    };

    try {
      await runWithAuthRetry(fetchClients);
    } catch (err) {
      if (isTokenExpiredError(err)) {
        console.warn('Token expirado al cargar clientes, se solicitará uno nuevo.');
        return;
      }
      console.error('Error loading clients:', err);
    }
  }, [runWithAuthRetry, setClients, token]);

  const addClient = useCallback(
    async (clientData: ClientPayload): Promise<number | null> => {
      const body = {
        company_id: clientData.company_id,
        tariff_id:
          typeof clientData.tariff_id === 'number' && Number.isFinite(clientData.tariff_id)
            ? clientData.tariff_id
            : null,
      };
      try {
        return await runWithAuthRetry(async () => {
          const res = await fetch(`${BASE_URL}/clients`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });
          await ensureAuthResponse(res);
          const data = await res.json();
          if (data.client_id) {
            await loadClients();
            return parseInt(data.client_id, 10);
          }
          return null;
        });
      } catch (err) {
        if (isTokenExpiredError(err)) {
          console.warn('Token expirado al agregar un cliente, se solicitará uno nuevo.');
          return null;
        }
        console.error('Error adding client:', err);
      }
      return null;
    },
    [loadClients, runWithAuthRetry, token]
  );

  const updateClient = useCallback(
    async (id: number, clientData: ClientUpdatePayload): Promise<boolean> => {
      const body: Record<string, unknown> = {};
      if (typeof clientData.company_id === 'number') {
        body.company_id = clientData.company_id;
      }
      if ('tariff_id' in clientData) {
        const tariffId =
          typeof clientData.tariff_id === 'number' && Number.isFinite(clientData.tariff_id)
            ? clientData.tariff_id
            : null;
        body.tariff_id = tariffId;
      }
      try {
        return await runWithAuthRetry(async () => {
          const res = await fetch(`${BASE_URL}/clients/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });
          await ensureAuthResponse(res);
          if (res.ok) {
            await loadClients();
            return true;
          }
          return false;
        });
      } catch (err) {
        if (isTokenExpiredError(err)) {
          console.warn('Token expirado al actualizar un cliente, se solicitará uno nuevo.');
          return false;
        }
        console.error('Error updating client:', err);
      }
      return false;
    },
    [loadClients, runWithAuthRetry, token]
  );

  const deleteClient = useCallback(async (id: number): Promise<boolean> => {
    try {
      return await runWithAuthRetry(async () => {
        const res = await fetch(`${BASE_URL}/clients/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        await ensureAuthResponse(res);
        const data = await res.json();
        if (data.message === 'Client deleted successfully') {
          setClients(prev => prev.filter(c => c.id !== id));
          return true;
        }
        return false;
      });
    } catch (err) {
      if (isTokenExpiredError(err)) {
        console.warn('Token expirado al eliminar un cliente, se solicitará uno nuevo.');
        return false;
      }
      console.error('Error deleting client:', err);
    }
    return false;
  }, [runWithAuthRetry, setClients, token]);

  useEffect(() => {
    if (token) loadClients();
  }, [loadClients, token]);

  return (
    <ClientsContext.Provider
      value={{
        clients,
        loadClients,
        addClient,
        updateClient,
        deleteClient,
      }}
    >
      {children}
    </ClientsContext.Provider>
  );
};

