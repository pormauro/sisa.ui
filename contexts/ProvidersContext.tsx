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

export interface Provider {
  id: number;
  business_name: string;
  tax_id?: string;
  email?: string;
  brand_file_id?: string | null;
  phone?: string;
  address?: string;
  created_at?: string | null;
  updated_at?: string | null;
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
  const [providers, setProviders] = useCachedState<Provider[]>(
    'providers',
    []
  );
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setProviders(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setProviders]);

  const loadProviders = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/providers`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.providers) {
        const fetchedProviders = data.providers as Provider[];
        setProviders(sortByNewest(fetchedProviders, getDefaultSortValue));
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  }, [setProviders, token]);

  const addProvider = useCallback(
    async (provider: Omit<Provider, 'id'>): Promise<Provider | null> => {
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
          setProviders(prev => ensureSortedByNewest([...prev, newProvider], getDefaultSortValue));
          await loadProviders();
          return newProvider;
        }
      } catch (error) {
        console.error('Error adding provider:', error);
      }
      return null;
    },
    [loadProviders, setProviders, token]
  );

  const updateProvider = useCallback(
    async (id: number, provider: Omit<Provider, 'id'>): Promise<boolean> => {
      try {
        const response = await fetch(`${BASE_URL}/providers/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(provider),
        });

        if (response.ok) {
          // Some endpoints may return 204 without a body. Attempt to parse JSON but ignore errors.
          try {
            await response.json();
          } catch {
            /* ignore body parsing errors */
          }

          setProviders(prev =>
            ensureSortedByNewest(
              prev.map(p => (p.id === id ? { id, ...provider } : p)),
              getDefaultSortValue
            )
          );
          await loadProviders();
          return true;
        }
      } catch (error) {
        console.error('Error updating provider:', error);
      }
      return false;
    },
    [loadProviders, setProviders, token]
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
      const data = await response.json();
      if (data.message === 'Provider deleted successfully') {
        setProviders(prev => prev.filter(p => p.id !== id));
        return true;
      }
    } catch (error) {
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

