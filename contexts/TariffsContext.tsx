// contexts/TariffsContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface Tariff {
  id: number;
  name: string;
  amount: number;
}

interface TariffsContextType {
  tariffs: Tariff[];
  loadTariffs: () => void;
  addTariff: (tariff: Omit<Tariff, 'id'>) => Promise<Tariff | null>;
  updateTariff: (id: number, tariff: Omit<Tariff, 'id'>) => Promise<boolean>;
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
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const { token } = useContext(AuthContext);

  const loadTariffs = async () => {
    try {
      const response = await fetch(`${BASE_URL}/tariffs`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.tariffs) {
        setTariffs(data.tariffs);
      }
    } catch (error) {
      console.error('Error loading tariffs:', error);
    }
  };

  const addTariff = async (tariff: Omit<Tariff, 'id'>): Promise<Tariff | null> => {
    try {
      const response = await fetch(`${BASE_URL}/tariffs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(tariff),
      });
      const data = await response.json();
      if (data.tariff_id) {
        const newTariff: Tariff = { id: parseInt(data.tariff_id, 10), ...tariff };
        setTariffs(prev => [...prev, newTariff]);
        return newTariff;
      }
    } catch (error) {
      console.error('Error adding tariff:', error);
    }
    return null;
  };

  const updateTariff = async (id: number, tariff: Omit<Tariff, 'id'>): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/tariffs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(tariff),
      });
      const data = await response.json();
      if (data.message === 'Tariff updated successfully') {
        setTariffs(prev => prev.map(t => (t.id === id ? { ...t, ...tariff } : t)));
        return true;
      }
    } catch (error) {
      console.error('Error updating tariff:', error);
    }
    return false;
  };

  const deleteTariff = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/tariffs/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
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
      loadTariffs();
    }
  }, [token]);

  return (
    <TariffsContext.Provider value={{ tariffs, loadTariffs, addTariff, updateTariff, deleteTariff }}>
      {children}
    </TariffsContext.Provider>
  );
};
