// /contexts/ClientsContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface Client {
  id: number;
  business_name: string;
  tax_id: string;
  email: string;
  brand_file_id: string | null;
  phone: string;
  address: string;
  tariff_id: number | null;
  created_at?: string;
  updated_at?: string;
}

interface ClientsContextValue {
  clients: Client[];
  loadClients: () => void;
  addClient: (client: Omit<Client, 'id'>) => Promise<Client | null>;
  updateClient: (id: number, client: Omit<Client, 'id'>) => Promise<boolean>;
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
      const response = await fetch(`${BASE_URL}/clients`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.clients) {
        const loaded: Client[] = data.clients.map((c: any) => ({
          ...c,
          tariff_id: c.tariff_id ?? null,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
        setClients(loaded);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const addClient = async (clientData: Omit<Client, 'id'>): Promise<Client | null> => {
    try {
      const response = await fetch(`${BASE_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(clientData)
      });
      const data = await response.json();
      if (data.client_id) {
        const newClient: Client = {
          id: parseInt(data.client_id, 10),
          ...clientData,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        setClients(prev => [...prev, newClient]);
        return newClient;
      }
    } catch (error) {
      console.error("Error adding client:", error);
    }
    return null;
  };

  const updateClient = async (id: number, clientData: Omit<Client, 'id'>): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(clientData)
      });
      const data = await response.json();
        if (data.message === 'Client updated successfully') {
        setClients(prev =>
          prev.map(client =>
            client.id === id
              ? { ...client, ...clientData, updated_at: data.updated_at }
              : client
          )
        );
        return true;
      }
    } catch (error) {
      console.error("Error updating client:", error);
    }
    return false;
  };

  const deleteClient = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/clients/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.message === 'Client deleted successfully') {
        setClients(prev => prev.filter(client => client.id !== id));
        return true;
      }
    } catch (error) {
      console.error("Error deleting client:", error);
    }
    return false;
  };

  useEffect(() => {
    if (token) {
      loadClients();
    }
  }, [token]);

  return (
    <ClientsContext.Provider value={{ clients, loadClients, addClient, updateClient, deleteClient }}>
      {children}
    </ClientsContext.Provider>
  );
};
