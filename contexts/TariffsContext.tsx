// contexts/TariffsContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useNetworkLog } from '@/contexts/NetworkLogContext';
import { useCachedState } from '@/hooks/useCachedState';
import { loggedFetch } from '@/utils/networkLogger';

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return fallback;
    }
    const direct = Number(trimmed);
    if (Number.isFinite(direct)) {
      return direct;
    }
    const sanitized = trimmed.replace(/,/g, '.');
    const withDot = Number(sanitized);
    if (Number.isFinite(withDot)) {
      return withDot;
    }
    const parsed = parseFloat(sanitized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const normalizeTariffs = (items: unknown[]): Tariff[] => {
  return items.map((rawItem) => {
    const item = rawItem as Partial<Tariff> & Record<string, unknown>;
    const id = toNumber(item.id, 0);
    const amount = toNumber(item.amount, 0);

    return {
      id,
      name: typeof item.name === 'string' ? item.name : '',
      amount,
      last_update: typeof item.last_update === 'string' ? item.last_update : '',
    };
  });
};

export interface Tariff {
  id: number;
  name: string;
  amount: number;
  last_update: string;
}

interface TariffsContextType {
  tariffs: Tariff[];
  loadTariffs: () => void;
  addTariff: (tariff: Omit<Tariff, 'id' | 'last_update'>) => Promise<Tariff | null>;
  updateTariff: (id: number, tariff: Omit<Tariff, 'id' | 'last_update'>) => Promise<boolean>;
  deleteTariff: (id: number) => Promise<boolean>;
}

export const TariffsContext = createContext<TariffsContextType>({
  tariffs: [],
  loadTariffs: () => {},
  addTariff: async () => null,
  updateTariff: async () => false,
  deleteTariff: async () => false,
});

export const TariffsProvider = ({ children }: { children: ReactNode }) => {
  const [tariffs, setTariffs] = useCachedState<Tariff[]>('tariffs', []);
  const { token } = useContext(AuthContext);
  const { appendLog } = useNetworkLog();

  useEffect(() => {
    setTariffs(prev => normalizeTariffs(prev));
  }, [setTariffs]);

  const loadTariffs = useCallback(async () => {
    try {
      const response = await loggedFetch(
        {
          url: `${BASE_URL}/tariffs`,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
        appendLog,
      );
      const data = await response.json();
      if (data.tariffs) {
        const parsed = normalizeTariffs(Array.isArray(data.tariffs) ? data.tariffs : []);
        setTariffs(parsed);
      }
    } catch (error) {
      console.error('Error loading tariffs:', error);
    }
  }, [appendLog, setTariffs, token]);

  const addTariff = useCallback(
    async (tariff: Omit<Tariff, 'id' | 'last_update'>): Promise<Tariff | null> => {
      try {
        const response = await loggedFetch(
          {
            url: `${BASE_URL}/tariffs`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(tariff),
          },
          appendLog,
        );
        const data = await response.json();
        if (data.tariff_id) {
          const newTariff: Tariff = {
            id: parseInt(data.tariff_id, 10),
            last_update: data.last_update || '',
            ...tariff,
          };
          setTariffs(prev => [...prev, newTariff]);
          await loadTariffs();
          return newTariff;
        }
      } catch (error) {
        console.error('Error adding tariff:', error);
      }
      return null;
    },
    [appendLog, loadTariffs, setTariffs, token]
  );

  const updateTariff = useCallback(
    async (id: number, tariff: Omit<Tariff, 'id' | 'last_update'>): Promise<boolean> => {
      try {
        const response = await loggedFetch(
          {
            url: `${BASE_URL}/tariffs/${id}`,
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(tariff),
          },
          appendLog,
        );
        const data = await response.json();
        if (data.message === 'Tariff updated successfully') {
          setTariffs(prev =>
            prev.map(t =>
              t.id === id ? { ...t, ...tariff, last_update: data.last_update || t.last_update } : t
            )
          );
          await loadTariffs();
          return true;
        }
      } catch (error) {
        console.error('Error updating tariff:', error);
      }
      return false;
    },
    [appendLog, loadTariffs, setTariffs, token]
  );

  const deleteTariff = async (id: number): Promise<boolean> => {
    try {
      const response = await loggedFetch(
        {
          url: `${BASE_URL}/tariffs/${id}`,
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
        appendLog,
      );
      const data = await response.json();
      if (data.message === 'Tariff deleted successfully') {
        setTariffs(prev => prev.filter(t => t.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Error deleting tariff:', error);
    }
    return false;
  };

  useEffect(() => {
    if (token) {
      void loadTariffs();
    }
  }, [loadTariffs, token]);

  return (
    <TariffsContext.Provider value={{ tariffs, loadTariffs, addTariff, updateTariff, deleteTariff }}>
      {children}
    </TariffsContext.Provider>
  );
};
