// C:/Users/Mauri/Documents/GitHub/router/contexts/CashBoxesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { ConfigContext } from '@/contexts/ConfigContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export interface CashBox {
  id: number;
  name: string;
  image_file_id: string | null;
  user_id: number;
  assigned_user_ids?: number[];
  created_at?: string | null;
  updated_at?: string | null;
  // Puedes agregar más campos si los requiere tu API
}

interface CashBoxesContextType {
  cashBoxes: CashBox[];
  loadCashBoxes: () => void;
  addCashBox: (cashBox: Omit<CashBox, 'id' | 'user_id'>) => Promise<CashBox | null>;
  updateCashBox: (id: number, cashBox: Omit<CashBox, 'id' | 'user_id'>) => Promise<boolean>;
  deleteCashBox: (id: number) => Promise<boolean>;
  listCashBoxHistory: (id: number) => Promise<any[]>; // Opcional, para historial
}

export const CashBoxesContext = createContext<CashBoxesContextType>({
  cashBoxes: [],
  loadCashBoxes: () => {},
  addCashBox: async () => null,
  updateCashBox: async () => false,
  deleteCashBox: async () => false,
  listCashBoxHistory: async () => []
});

export const CashBoxesProvider = ({ children }: { children: ReactNode }) => {
  const [cashBoxes, setCashBoxes] = useCachedState<CashBox[]>(
    'cash_boxes',
    []
  );
  const { token } = useContext(AuthContext);
  const configContext = useContext(ConfigContext);
  const configDetails = configContext?.configDetails;
  const updateConfig = configContext?.updateConfig;

  useEffect(() => {
    setCashBoxes(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setCashBoxes]);

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
        const normalized = data.cash_boxes.map((cb: CashBox) => ({
          ...cb,
          assigned_user_ids: cb.assigned_user_ids ?? []
        }));
        setCashBoxes(sortByNewest(normalized, getDefaultSortValue));
      }
    } catch (error) {
      console.error("Error loading cash boxes:", error);
    }
  }, [setCashBoxes, token]);

  const addCashBox = useCallback(
    async (cashBoxData: Omit<CashBox, 'id' | 'user_id'>): Promise<CashBox | null> => {
      try {
        const response = await fetch(`${BASE_URL}/cash_boxes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...cashBoxData,
            assigned_user_ids: cashBoxData.assigned_user_ids ?? []
          })
        });
        const data = await response.json();
        if (data.cash_box_id) {
          const newCashBox: CashBox = {
            id: parseInt(data.cash_box_id, 10),
            user_id: 0,
            assigned_user_ids: cashBoxData.assigned_user_ids ?? [],
            ...cashBoxData
          };
          setCashBoxes(prev => ensureSortedByNewest([...prev, newCashBox], getDefaultSortValue));
          await loadCashBoxes();
          return newCashBox;
        }
      } catch (error) {
        console.error("Error adding cash box:", error);
      }
      return null;
    },
    [loadCashBoxes, setCashBoxes, token]
  );

  const updateCashBox = useCallback(
    async (id: number, cashBoxData: Omit<CashBox, 'id' | 'user_id'>): Promise<boolean> => {
      try {
        const response = await fetch(`${BASE_URL}/cash_boxes/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...cashBoxData,
            assigned_user_ids: cashBoxData.assigned_user_ids ?? []
          })
        });
        const data = await response.json();
        if (data.message === 'Cash box updated successfully') {
          setCashBoxes(prev =>
            ensureSortedByNewest(
              prev.map(cb =>
                cb.id === id
                  ? { ...cb, ...cashBoxData, assigned_user_ids: cashBoxData.assigned_user_ids ?? [] }
                  : cb
              ),
              getDefaultSortValue
            )
          );
          await loadCashBoxes();
          return true;
        }
      } catch (error) {
        console.error("Error updating cash box:", error);
      }
      return false;
    },
    [loadCashBoxes, setCashBoxes, token]
  );

  const deleteCashBox = async (id: number): Promise<boolean> => {
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
        if (configDetails && updateConfig) {
          const shouldClearPayment = id === configDetails.default_payment_cash_box_id;
          const shouldClearReceiving = id === configDetails.default_receiving_cash_box_id;

          if (shouldClearPayment || shouldClearReceiving) {
            await updateConfig({
              ...configDetails,
              default_payment_cash_box_id: shouldClearPayment
                ? null
                : configDetails.default_payment_cash_box_id,
              default_receiving_cash_box_id: shouldClearReceiving
                ? null
                : configDetails.default_receiving_cash_box_id
            });
          }
        }
        return true;
      }
    } catch (error) {
      console.error("Error deleting cash box:", error);
    }
    return false;
  };

  const listCashBoxHistory = async (id: number): Promise<any[]> => {
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
  };

  useEffect(() => {
    if (token) {
      void loadCashBoxes();
    }
  }, [loadCashBoxes, token]);

  return (
    <CashBoxesContext.Provider
      value={{ cashBoxes, loadCashBoxes, addCashBox, updateCashBox, deleteCashBox, listCashBoxHistory }}
    >
      {children}
    </CashBoxesContext.Provider>
  );
};
