import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';

export interface Status {
  id: number;
  label: string;
  value: string;
  background_color: string;
  order_index: number;
  version: number;
  created_at?: string;
  updated_at?: string;
}

interface StatusesContextType {
  statuses: Status[];
  loadStatuses: () => void;
  addStatus: (
    status: Omit<Status, 'id' | 'created_at' | 'updated_at' | 'version'>
  ) => Promise<Status | null>;
  updateStatus: (
    id: number,
    status: Omit<Status, 'id' | 'created_at' | 'updated_at' | 'version'>
  ) => Promise<boolean>;
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
  const [statuses, setStatuses] = useCachedState<Status[]>(
    'statuses',
    []
  );
  const { token } = useContext(AuthContext);

  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/statuses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.statuses) {
        setStatuses(data.statuses);
      }
    } catch (err) {
      console.error('Error loading statuses:', err);
    }
  }, [setStatuses, token]);

  const addStatus = async (
    statusData: Omit<Status, 'id' | 'created_at' | 'updated_at' | 'version'>
  ): Promise<Status | null> => {
    try {
      const res = await fetch(`${BASE_URL}/statuses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(statusData),
      });
      const data = await res.json();
      if (data.status_id) {
        const newStatus: Status = {
          id: parseInt(data.status_id, 10),
          version: 1,
          ...statusData,
        };
        setStatuses(prev => [...prev, newStatus]);
        return newStatus;
      }
    } catch (err) {
      console.error('Error adding status:', err);
    }
    return null;
  };

  const updateStatus = async (
    id: number,
    statusData: Omit<Status, 'id' | 'created_at' | 'updated_at' | 'version'>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/statuses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(statusData),
      });
      if (res.ok) {
        setStatuses(prev =>
          prev.map(s => (s.id === id ? { ...s, ...statusData } : s))
        );
        return true;
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
    return false;
  };

  const deleteStatus = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/statuses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.message === 'Status deleted successfully') {
        setStatuses(prev => prev.filter(s => s.id !== id));
        return true;
      }
    } catch (err) {
      console.error('Error deleting status:', err);
    }
    return false;
  };

  const reorderStatuses = async (orderedIds: number[]): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/statuses/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      const data = await res.json();
      if (data.message === 'Statuses reordered successfully') {
        await loadStatuses();
        return true;
      }
    } catch (err) {
      console.error('Error reordering statuses:', err);
    }
    return false;
  };

  useEffect(() => {
    if (token) void loadStatuses();
  }, [loadStatuses, token]);

  return (
    <StatusesContext.Provider
      value={{
        statuses,
        loadStatuses,
        addStatus,
        updateStatus,
        deleteStatus,
        reorderStatuses,
      }}
    >
      {children}
    </StatusesContext.Provider>
  );
};

