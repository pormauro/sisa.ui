// contexts/StatusesContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface Status {
  id: number;
  label: string;
  value: string;
  background_color: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface StatusesContextType {
  statuses: Status[];
  loadStatuses: () => void;
  addStatus: (status: Omit<Status, 'id' | 'created_at' | 'updated_at'>) => Promise<Status | null>;
  updateStatus: (id: number, status: Omit<Status, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  deleteStatus: (id: number) => Promise<boolean>;
  reorderStatuses: (orderedIds: number[]) => Promise<boolean>;
}

export const StatusesContext = createContext<StatusesContextType>({
  statuses: [],
  loadStatuses: () => {},
  addStatus: async () => null,
  updateStatus: async () => false,
  deleteStatus: async () => false,
  reorderStatuses: async () => false,
});

export const StatusesProvider = ({ children }: { children: ReactNode }) => {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const { token } = useContext(AuthContext);

  const loadStatuses = async () => {
    try {
      const response = await fetch(`${BASE_URL}/statuses`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.statuses) {
        setStatuses(data.statuses);
      }
    } catch (error) {
      console.error("Error loading statuses:", error);
    }
  };

  const addStatus = async (statusData: Omit<Status, 'id' | 'created_at' | 'updated_at'>): Promise<Status | null> => {
    try {
      const response = await fetch(`${BASE_URL}/statuses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(statusData),
      });
      const data = await response.json();
      if (data.status_id) {
        const newStatus: Status = {
          id: parseInt(data.status_id, 10),
          created_at: "", // El API debería devolver estas fechas o se recargan en loadStatuses
          updated_at: "",
          ...statusData,
        };
        setStatuses(prev => [...prev, newStatus]);
        return newStatus;
      }
    } catch (error) {
      console.error("Error adding status:", error);
    }
    return null;
  };

  const updateStatus = async (
    id: number,
    statusData: Omit<Status, 'id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/statuses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(statusData),
      });
      const data = await response.json();
      if (data.message === 'Status updated successfully') {
        setStatuses(prev => prev.map(s => (s.id === id ? { ...s, ...statusData } : s)));
        return true;
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
    return false;
  };

  const deleteStatus = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/statuses/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.message === 'Status deleted successfully') {
        setStatuses(prev => prev.filter(s => s.id !== id));
        return true;
      }
    } catch (error) {
      console.error("Error deleting status:", error);
    }
    return false;
  };

  const reorderStatuses = async (orderedIds: number[]): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/statuses/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      const data = await response.json();
      if (data.message === 'Statuses reordered successfully') {
        await loadStatuses();
        return true;
      }
    } catch (error) {
      console.error("Error reordering statuses:", error);
    }
    return false;
  };

  useEffect(() => {
    if (token) {
      loadStatuses();
    }
  }, [token]);

  return (
    <StatusesContext.Provider
      value={{ statuses, loadStatuses, addStatus, updateStatus, deleteStatus, reorderStatuses }}
    >
      {children}
    </StatusesContext.Provider>
  );
};
