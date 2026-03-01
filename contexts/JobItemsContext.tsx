import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

export type JobItem = {
  id: number;
  job_id: number;
  description?: string | null;
  status: 'open' | 'done' | 'cancelled';
  order_index: number;
  created_at?: string;
  updated_at?: string;
};

type NewJobItemPayload = {
  job_id: number;
  description?: string | null;
  status: 'open' | 'done' | 'cancelled';
  order_index: number;
};

type UpdateJobItemPayload = Partial<Omit<NewJobItemPayload, 'job_id'>>;

type JobItemsContextType = {
  jobItems: JobItem[];
  loadJobItems: (jobId: number) => Promise<void>;
  addJobItem: (data: NewJobItemPayload) => Promise<boolean>;
  updateJobItem: (jobId: number, id: number, data: UpdateJobItemPayload) => Promise<boolean>;
  deleteJobItem: (id: number) => Promise<boolean>;
};

export const JobItemsContext = createContext<JobItemsContextType>({
  jobItems: [],
  loadJobItems: async () => {},
  addJobItem: async () => false,
  updateJobItem: async () => false,
  deleteJobItem: async () => false,
});

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStatus = (status: unknown): JobItem['status'] => {
  if (status === 'done' || status === 'cancelled') {
    return status;
  }
  return 'open';
};

const normalizeJobItem = (item: any): JobItem => {
  return {
    id: toNumber(item?.id),
    job_id: toNumber(item?.job_id),
    description: item?.description ?? null,
    status: normalizeStatus(item?.status),
    order_index: toNumber(item?.order_index),
    created_at: item?.created_at,
    updated_at: item?.updated_at,
  };
};

type JobItemMutationResponse = {
  message?: string;
  item?: unknown;
};

const readJsonSafely = async <T,>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const sortByOrderIndex = (items: JobItem[]): JobItem[] => {
  return [...items].sort((a, b) => {
    if (a.order_index === b.order_index) {
      return a.id - b.id;
    }
    return a.order_index - b.order_index;
  });
};

export const JobItemsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const [jobItems, setJobItems] = useCachedState<JobItem[]>('job_items', []);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    [token]
  );

  const loadJobItems = useCallback(async (jobId: number) => {
    try {
      const res = await fetch(`${BASE_URL}/jobs/${jobId}/items`, {
        headers: authHeaders,
      });
      if (!res.ok) {
        return;
      }

      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];
      setJobItems(list.map(normalizeJobItem));
    } catch (error) {
      console.error('Error loading job items:', error);
    }
  }, [authHeaders, setJobItems]);

  const addJobItem = useCallback(async (data: NewJobItemPayload) => {
    try {
      const res = await fetch(`${BASE_URL}/jobs/${data.job_id}/items`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          description: data.description,
          status: data.status,
          order_index: data.order_index,
        }),
      });

      if (!res.ok) {
        return false;
      }

      const payload = await readJsonSafely<JobItemMutationResponse>(res);
      if (payload?.item) {
        const createdItem = normalizeJobItem(payload.item);
        setJobItems(prev => {
          const alreadyExists = prev.some(item => item.id === createdItem.id);
          if (alreadyExists) {
            return prev;
          }
          return sortByOrderIndex([...prev, createdItem]);
        });
      }

      return true;
    } catch (error) {
      console.error('Error creating job item:', error);
      return false;
    }
  }, [authHeaders, setJobItems]);

  const updateJobItem = useCallback(async (jobId: number, id: number, data: UpdateJobItemPayload) => {
    try {
      const res = await fetch(`${BASE_URL}/jobs/${jobId}/items/${id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        return false;
      }

      const payload = await readJsonSafely<JobItemMutationResponse>(res);
      if (payload?.item) {
        const updatedItem = normalizeJobItem(payload.item);
        setJobItems(prev =>
          sortByOrderIndex(prev.map(item => (item.id === id ? { ...item, ...updatedItem } : item)))
        );
      }

      return true;
    } catch (error) {
      console.error('Error updating job item:', error);
      return false;
    }
  }, [authHeaders, setJobItems]);

  const deleteJobItem = useCallback(async (id: number) => {
    try {
      const targetItem = jobItems.find(item => item.id === id);
      if (!targetItem) {
        return false;
      }

      const res = await fetch(`${BASE_URL}/jobs/${targetItem.job_id}/items/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (!res.ok) {
        return false;
      }

      await readJsonSafely<JobItemMutationResponse>(res);

      setJobItems(prev => prev.filter(item => item.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting job item:', error);
      return false;
    }
  }, [authHeaders, jobItems, setJobItems]);

  return (
    <JobItemsContext.Provider
      value={{
        jobItems,
        loadJobItems,
        addJobItem,
        updateJobItem,
        deleteJobItem,
      }}
    >
      {children}
    </JobItemsContext.Provider>
  );
};
