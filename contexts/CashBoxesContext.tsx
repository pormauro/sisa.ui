// C:/Users/Mauri/Documents/GitHub/router/contexts/CashBoxesContext.tsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface CashBox {
  id: number;
  name: string;
  image_file_id: string | null;
  user_id: number;
  // Puedes agregar más campos si los requiere tu API
}

interface CashBoxesContextType {
  cashBoxes: CashBox[];
  loadCashBoxes: () => void;
  addCashBox: (cashBox: Omit<CashBox, 'id' | 'user_id'>) => Promise<CashBox | null>;
  updateCashBox: (id: number, cashBox: Omit<CashBox, 'id' | 'user_id'>) => Promise<boolean>;
  deleteCashBox: (id: number) => Promise<boolean>;
  listCashBoxHistory: (id: number) => Promise<any[]>; // Opcional, para historial
  selectedCashBox: CashBox | null;
  setSelectedCashBox: (cashBox: CashBox | null) => void;
}

export const CashBoxesContext = createContext<CashBoxesContextType>({
  cashBoxes: [],
  loadCashBoxes: () => {},
  addCashBox: async () => null,
  updateCashBox: async () => false,
  deleteCashBox: async () => false,
  listCashBoxHistory: async () => [],
  selectedCashBox: null,
  setSelectedCashBox: () => {},
});

export const CashBoxesProvider = ({ children }: { children: ReactNode }) => {
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [selectedCashBox, setSelectedCashBox] = useState<CashBox | null>(null);
  const { token } = useContext(AuthContext);

  const loadCashBoxes = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/cash_boxes`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.cash_boxes) {
        setCashBoxes(data.cash_boxes);
        setSelectedCashBox(prev => {
          if (!prev) return null;
          const refreshed = data.cash_boxes.find((cb: CashBox) => cb.id === prev.id);
          return refreshed ?? null;
        });
      }
    } catch (error) {
      console.error("Error loading cash boxes:", error);
    }
  }, [token]);

  const addCashBox = useCallback(async (
    cashBoxData: Omit<CashBox, 'id' | 'user_id'>
  ): Promise<CashBox | null> => {
    try {
      const response = await fetch(`${BASE_URL}/cash_boxes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cashBoxData)
      });
      const data = await response.json();
      if (data.cash_box_id) {
        const newCashBox: CashBox = { id: parseInt(data.cash_box_id, 10), user_id: 0, ...cashBoxData };
        setCashBoxes(prev => [...prev, newCashBox]);
        setSelectedCashBox(newCashBox);
        return newCashBox;
      }
    } catch (error) {
      console.error("Error adding cash box:", error);
    }
    return null;
  }, [token]);

  const updateCashBox = useCallback(async (
    id: number,
    cashBoxData: Omit<CashBox, 'id' | 'user_id'>
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/cash_boxes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cashBoxData)
      });
      const data = await response.json();
      if (data.message === 'Cash box updated successfully') {
        setCashBoxes(prev =>
          prev.map(cb => (cb.id === id ? { ...cb, ...cashBoxData } : cb))
        );
        setSelectedCashBox(prev =>
          prev && prev.id === id ? { ...prev, ...cashBoxData } : prev
        );
        return true;
      }
    } catch (error) {
      console.error("Error updating cash box:", error);
    }
    return false;
  }, [token]);

  const deleteCashBox = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/cash_boxes/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.message === 'Cash box deleted successfully') {
        setCashBoxes(prev => prev.filter(cb => cb.id !== id));
        setSelectedCashBox(prev => (prev && prev.id === id ? null : prev));
        return true;
      }
    } catch (error) {
      console.error("Error deleting cash box:", error);
    }
    return false;
  }, [token]);

  const listCashBoxHistory = useCallback(async (id: number): Promise<any[]> => {
    try {
      const response = await fetch(`${BASE_URL}/cash_boxes/${id}/history`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.history) {
        return data.history;
      }
    } catch (error) {
      console.error("Error listing cash box history:", error);
    }
    return [];
  }, [token]);

  useEffect(() => {
    if (token) {
      loadCashBoxes();
    }
  }, [loadCashBoxes, token]);

  return (
    <CashBoxesContext.Provider
      value={{
        cashBoxes,
        loadCashBoxes,
        addCashBox,
        updateCashBox,
        deleteCashBox,
        listCashBoxHistory,
        selectedCashBox,
        setSelectedCashBox,
      }}
    >
      {children}
    </CashBoxesContext.Provider>
  );
};
