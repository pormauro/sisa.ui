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

const normalizeStatus = (
  raw: Partial<Status> & Record<string, unknown>
): Status => {
  return {
    id: toNumber(raw.id, 0),
    label: typeof raw.label === 'string' ? raw.label : '',
    background_color:
      typeof raw.background_color === 'string' ? raw.background_color : '#ffffff',
    order_index: toNumber(raw.order_index, 0),
    version: toNumber(raw.version, 0),
    created_at: typeof raw.created_at === 'string' ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  };
};

const normalizeStatuses = (items: unknown[]): Status[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.reduce<Status[]>((acc, item) => {
    if (item && typeof item === 'object') {
      acc.push(normalizeStatus(item as Partial<Status> & Record<string, unknown>));
    }
    return acc;
  }, []);
};

export const StatusesProvider = ({ children }: { children: ReactNode }) => {
  const [statuses, setStatuses] = useCachedState<Status[]>(
    'statuses',
    []
  );
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setStatuses(prev => normalizeStatuses(prev));
  }, [setStatuses]);

  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/statuses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.statuses) {
        setStatuses(normalizeStatuses(data.statuses));
      }
    } catch (err) {
      console.error('Error loading statuses:', err);
    }
  }, [setStatuses, token]);

  const addStatus = useCallback(
    async (
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
          const newStatus = normalizeStatus({
            id: parseInt(data.status_id, 10),
            version: 1,
            ...statusData,
          });
          setStatuses(prev => [...prev, newStatus]);
          await loadStatuses();
          return newStatus;
        }
      } catch (err) {
        console.error('Error adding status:', err);
      }
      return null;
    },
    [loadStatuses, setStatuses, token]
  );

  const updateStatus = useCallback(
    async (
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
            prev.map(s =>
              s.id === id
                ? normalizeStatus({ ...s, ...statusData, id })
                : s
            )
          );
          await loadStatuses();
          return true;
        }
      } catch (err) {
        console.error('Error updating status:', err);
      }
      return false;
    },
    [loadStatuses, setStatuses, token]
  );

  const deleteStatus = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetch(`${BASE_URL}/statuses/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        const responseText = await res.text();
        let data: Record<string, unknown> | null = null;

        if (responseText) {
          try {
            const parsed = JSON.parse(responseText) as unknown;
            if (parsed && typeof parsed === 'object') {
              data = parsed as Record<string, unknown>;
            }
          } catch (parseError) {
            console.warn('Unexpected delete status response format:', parseError);
          }
        }

        if (!res.ok) {
          const errorMessage =
            (data && typeof data.error === 'string' && data.error) ||
            (data && typeof data.message === 'string' && data.message) ||
            res.statusText;
          console.error('Error deleting status:', errorMessage);
          return false;
        }

        if (data && typeof data.error === 'string') {
          console.error('Error deleting status:', data.error);
          return false;
        }

        setStatuses(prev => prev.filter(s => s.id !== id));
        await loadStatuses();
        return true;
      } catch (err) {
        console.error('Error deleting status:', err);
      }
      return false;
    },
    [loadStatuses, setStatuses, token]
  );

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

