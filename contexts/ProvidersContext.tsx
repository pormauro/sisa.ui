// /contexts/ProvidersContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface Provider {
  id: number;
  business_name: string;
  tax_id: string;
  email: string;
  brand_file_id: string | null;
  phone: string;
  address: string;
}

interface ProvidersContextValue {
  providers: Provider[];
  loadProviders: () => void;
  addProvider: (provider: Omit<Provider, 'id'>) => Promise<Provider | null>;
  updateProvider: (id: number, provider: Omit<Provider, 'id'>) => Promise<boolean>;
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
  const [providers, setProviders] = useState<Provider[]>([]);
  const { token } = useContext(AuthContext);

  const loadProviders = async () => {
    try {
      const response = await fetch(`${BASE_URL}/providers`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.providers) {
        setProviders(data.providers);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const addProvider = async (provider: Omit<Provider, 'id'>): Promise<Provider | null> => {
    try {
      const response = await fetch(`${BASE_URL}/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(provider),
      });
      const data = await response.json();
      if (data.provider_id) {
        const newProvider: Provider = { id: parseInt(data.provider_id, 10), ...provider };
        setProviders(prev => [...prev, newProvider]);
        return newProvider;
      }
    } catch (error) {
      console.error('Error adding provider:', error);
    }
    return null;
  };

  const updateProvider = async (id: number, provider: Omit<Provider, 'id'>): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/providers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(provider),
      });
      const data = await response.json();
      if (data.message === 'Provider updated successfully') {
        setProviders(prev => prev.map(p => (p.id === id ? { id, ...provider } : p)));
        return true;
      }
    } catch (error) {
      console.error('Error updating provider:', error);
    }
    return false;
  };

  const deleteProvider = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/providers/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.message === 'Provider deleted successfully') {
        setProviders(prev => prev.filter(p => p.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
    return false;
  };

  useEffect(() => {
    if (token) {
      loadProviders();
    }
  }, [token]);

  return (
    <ProvidersContext.Provider value={{ providers, loadProviders, addProvider, updateProvider, deleteProvider }}>
      {children}
    </ProvidersContext.Provider>
  );
};

