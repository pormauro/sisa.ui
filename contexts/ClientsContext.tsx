import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';

const sanitizeNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length === 0 ? null : str;
};

const sanitizeBrandFileId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length === 0 ? null : str;
};

const sanitizeTariffId = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseVersion = (value: unknown, fallback: number = 1): number => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const sanitizeClientPayload = (payload: ClientPayload): ClientPayload => ({
  business_name: payload.business_name.trim(),
  tax_id: sanitizeNullableString(payload.tax_id),
  email: sanitizeNullableString(payload.email),
  phone: sanitizeNullableString(payload.phone),
  address: sanitizeNullableString(payload.address),
  brand_file_id: sanitizeBrandFileId(payload.brand_file_id),
  tariff_id: sanitizeTariffId(payload.tariff_id),
});

const parseClient = (raw: any): Client => ({
  id: Number(raw.id),
  business_name:
    typeof raw.business_name === 'string' ? raw.business_name : '',
  tax_id: sanitizeNullableString(raw.tax_id),
  email: sanitizeNullableString(raw.email),
  brand_file_id: sanitizeBrandFileId(raw.brand_file_id),
  phone: sanitizeNullableString(raw.phone),
  address: sanitizeNullableString(raw.address),
  tariff_id: sanitizeTariffId(raw.tariff_id),
  version: parseVersion(raw.version, 1),
  created_at: sanitizeNullableString(raw.created_at),
  updated_at: sanitizeNullableString(raw.updated_at),
});

const parseResponseBody = async (response: Response): Promise<any | null> => {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export interface Client {
  id: number;
  business_name: string;
  tax_id: string | null;
  email: string | null;
  brand_file_id: string | null;
  phone: string | null;
  address: string | null;
  tariff_id: number | null;
  version: number;
  created_at: string | null;
  updated_at: string | null;
}

export type ClientPayload = {
  business_name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  brand_file_id: string | null;
  tariff_id: number | null;
};

interface ClientsContextValue {
  clients: Client[];
  loadClients: () => void;
  addClient: (client: ClientPayload) => Promise<Client | null>;
  updateClient: (id: number, client: ClientPayload) => Promise<boolean>;
  deleteClient: (id: number) => Promise<boolean>;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
}

export const ClientsContext = createContext<ClientsContextValue>({
  clients: [],
  loadClients: () => {},
  addClient: async () => null,
  updateClient: async () => false,
  deleteClient: async () => false,
  selectedClient: null,
  setSelectedClient: () => {},
});

export const ClientsProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClientState] = useState<Client | null>(null);
  const { token } = useContext(AuthContext);

  const loadClients = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data?.clients)) {
        const fetchedClients = (data.clients as any[]).map(parseClient);
        setClients(fetchedClients);
        setSelectedClientState(prev => {
          if (!prev) return null;
          const refreshed = fetchedClients.find(c => c.id === prev.id);
          return refreshed ?? null;
        });
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }, [token]);

  const addClient = useCallback(
    async (clientData: ClientPayload): Promise<Client | null> => {
      const sanitizedPayload = sanitizeClientPayload(clientData);
      try {
        const res = await fetch(`${BASE_URL}/clients`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(sanitizedPayload),
        });
        const data = await parseResponseBody(res);
        if (!res.ok) {
          if (data?.error) {
            console.error('Error adding client:', data.error);
          }
          return null;
        }

        let createdClient: Client | null = null;
        if (data?.client) {
          createdClient = parseClient(data.client);
        } else if (data?.client_id) {
          createdClient = {
            id: Number.parseInt(String(data.client_id), 10),
            business_name: sanitizedPayload.business_name,
            tax_id: sanitizedPayload.tax_id,
            email: sanitizedPayload.email,
            brand_file_id: sanitizedPayload.brand_file_id,
            phone: sanitizedPayload.phone,
            address: sanitizedPayload.address,
            tariff_id: sanitizedPayload.tariff_id,
            version: parseVersion(data?.version, 1),
            created_at: sanitizeNullableString(data?.created_at),
            updated_at: sanitizeNullableString(data?.updated_at),
          };
        }

        if (createdClient) {
          setClients(prev => [...prev, createdClient]);
          setSelectedClientState(createdClient);
          return createdClient;
        }
      } catch (err) {
        console.error('Error adding client:', err);
      }
      return null;
    },
    [token]
  );

  const updateClient = useCallback(
    async (id: number, clientData: ClientPayload): Promise<boolean> => {
      const sanitizedPayload = sanitizeClientPayload(clientData);
      try {
        const res = await fetch(`${BASE_URL}/clients/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(sanitizedPayload),
        });

        const data = await parseResponseBody(res);
        if (!res.ok) {
          if (data?.error) {
            console.error('Error updating client:', data.error);
          }
          return false;
        }

        const updatedFromServer = data?.client
          ? parseClient(data.client)
          : null;
        const updatedAtFromServer = sanitizeNullableString(data?.updated_at);
        const versionFromServer = data?.version;

        if (updatedFromServer) {
          setClients(prev =>
            prev.map(c => (c.id === id ? updatedFromServer : c))
          );
          setSelectedClientState(prev =>
            prev && prev.id === id ? updatedFromServer : prev
          );
        } else {
          setClients(prev =>
            prev.map(c =>
              c.id === id
                ? {
                    ...c,
                    ...sanitizedPayload,
                    updated_at: updatedAtFromServer ?? c.updated_at,
                    version: parseVersion(versionFromServer, c.version),
                  }
                : c
            )
          );
          setSelectedClientState(prev => {
            if (!prev || prev.id !== id) return prev;
            return {
              ...prev,
              ...sanitizedPayload,
              updated_at: updatedAtFromServer ?? prev.updated_at,
              version: parseVersion(versionFromServer, prev.version),
            };
          });
        }

        return true;
      } catch (err) {
        console.error('Error updating client:', err);
      }
      return false;
    },
    [token]
  );

  const deleteClient = useCallback(async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/clients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.message === 'Client deleted successfully') {
        setClients(prev => prev.filter(c => c.id !== id));
        setSelectedClientState(prev => (prev && prev.id === id ? null : prev));
        return true;
      }
    } catch (err) {
      console.error('Error deleting client:', err);
    }
    return false;
  }, [token]);

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
        selectedClient,
        setSelectedClient: setSelectedClientState,
      }}
    >
      {children}
    </ClientsContext.Provider>
  );
};

