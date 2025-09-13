import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';

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
  const [clients, setClients] = useState<Client[]>([]);
  const { token } = useContext(AuthContext);

  const loadClients = async () => {
    try {
      const res = await fetch(`${BASE_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.clients) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const addClient = async (
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
        return newClient;
      }
    } catch (err) {
      console.error('Error adding client:', err);
    }
    return null;
  };

  const updateClient = async (
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
        return true;
      }
    } catch (err) {
      console.error('Error updating client:', err);
    }
    return false;
  };

  const deleteClient = async (id: number): Promise<boolean> => {
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
  };

  useEffect(() => {
    if (token) loadClients();
  }, [token]);

  return (
    <ClientsContext.Provider
      value={{ clients, loadClients, addClient, updateClient, deleteClient }}
    >
      {children}
    </ClientsContext.Provider>
  );
};

