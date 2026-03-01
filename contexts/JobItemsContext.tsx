import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

export type JobItem = {
  id: number;
  job_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at?: string;
  updated_at?: string;
};

type NewJobItemPayload = {
  job_id: number;
  description: string;
  quantity: number;
  unit_price: number;
};

type JobItemsContextType = {
  jobItems: JobItem[];
  loadJobItems: (jobId: number) => Promise<void>;
  addJobItem: (data: NewJobItemPayload) => Promise<boolean>;
  updateJobItem: (id: number, data: Partial<JobItem>) => Promise<boolean>;
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

const normalizeJobItem = (item: any): JobItem => {
  const quantity = toNumber(item?.quantity);
  const unitPrice = toNumber(item?.unit_price);
  const explicitTotal = toNumber(item?.total);
  const total = explicitTotal > 0 ? explicitTotal : quantity * unitPrice;

  return {
    id: toNumber(item?.id),
    job_id: toNumber(item?.job_id),
    description: item?.description ?? '',
    quantity,
    unit_price: unitPrice,
    total,
    created_at: item?.created_at,
    updated_at: item?.updated_at,
  };
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
      const res = await fetch(`${BASE_URL}/job-items?job_id=${jobId}`, {
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
      const res = await fetch(`${BASE_URL}/job-items`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error creating job item:', error);
      return false;
    }
  }, [authHeaders]);

  const updateJobItem = useCallback(async (id: number, data: Partial<JobItem>) => {
    try {
      const res = await fetch(`${BASE_URL}/job-items/${id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating job item:', error);
      return false;
    }
  }, [authHeaders]);

  const deleteJobItem = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/job-items/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (!res.ok) {
        return false;
      }

      setJobItems(prev => prev.filter(item => item.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting job item:', error);
      return false;
    }
  }, [authHeaders, setJobItems]);

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
