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

export interface Client {
  id: number;
  business_name: string;
  tax_id: string;
  email: string;
  brand_file_id: string | null;
  phone: string;
  address: string;
  tariff_id: number | null;
  version: number;
  created_at?: string;
  updated_at?: string;
}

interface ClientsContextValue {
  clients: Client[];
  loadClients: () => void;
  addClient: (client: Omit<Client, 'id' | 'version'>) => Promise<Client | null>;
  updateClient: (
    id: number,
    client: Omit<Client, 'id' | 'version'>
  ) => Promise<boolean>;
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
  const { token } = useContext(AuthContext);

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.clients) {
        const fetchedClients = data.clients as Client[];
        setClients(fetchedClients);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }, [setClients, token]);

  const addClient = useCallback(
    async (
      clientData: Omit<Client, 'id' | 'version'>
    ): Promise<Client | null> => {
      try {
        const res = await fetch(`${BASE_URL}/clients`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(clientData),
        });
        const data = await res.json();
        if (data.client_id) {
          const newClient: Client = {
            id: parseInt(data.client_id, 10),
            version: 1,
            ...clientData,
          };
          setClients(prev => [...prev, newClient]);
          await loadClients();
          return newClient;
        }
      } catch (err) {
        console.error('Error adding client:', err);
      }
      return null;
    },
    [loadClients, setClients, token]
  );

  const updateClient = useCallback(
    async (
      id: number,
      clientData: Omit<Client, 'id' | 'version'>
    ): Promise<boolean> => {
      try {
        const res = await fetch(`${BASE_URL}/clients/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(clientData),
        });
        if (res.ok) {
          setClients(prev =>
            prev.map(c => (c.id === id ? { ...c, ...clientData } : c))
          );
          await loadClients();
          return true;
        }
      } catch (err) {
        console.error('Error updating client:', err);
      }
      return false;
    },
    [loadClients, setClients, token]
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
        return true;
      }
    } catch (err) {
      console.error('Error deleting client:', err);
    }
    return false;
  }, [setClients, token]);

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

