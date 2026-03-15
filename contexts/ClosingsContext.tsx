import React, { createContext, ReactNode, useCallback, useContext, useEffect } from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export interface AccountingClosing {
  id: number;
  user_id?: number | null;
  cash_box_id: number;
  closing_date: string;
  final_balance: number;
  total_income: number;
  total_payments: number;
  comments?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AccountingClosingHistory {
  id?: number;
  action_type?: string | null;
  changed_at?: string | null;
  changed_by?: number | null;
  cash_box_id?: number | null;
  closing_date?: string | null;
  final_balance?: number | null;
  total_income?: number | null;
  total_payments?: number | null;
  comments?: string | null;
}

interface ClosingPayload {
  cash_box_id: number;
  closing_date: string;
  final_balance: number;
  total_income: number;
  total_payments?: number;
  total_expenses?: number;
  comments?: string | null;
}

interface ClosingsContextValue {
  closings: AccountingClosing[];
  loadClosings: () => Promise<void>;
  addClosing: (payload: ClosingPayload) => Promise<number | null>;
  updateClosing: (id: number, payload: ClosingPayload) => Promise<boolean>;
  deleteClosing: (id: number) => Promise<boolean>;
  getClosingHistory: (id: number) => Promise<AccountingClosingHistory[]>;
}

export const ClosingsContext = createContext<ClosingsContextValue>({
  closings: [],
  loadClosings: async () => {},
  addClosing: async () => null,
  updateClosing: async () => false,
  deleteClosing: async () => false,
  getClosingHistory: async () => [],
});

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeClosing = (record: Record<string, unknown>): AccountingClosing => ({
  id: toNullableNumber(record.id) ?? 0,
  user_id: toNullableNumber(record.user_id),
  cash_box_id: toNullableNumber(record.cash_box_id) ?? 0,
  closing_date: typeof record.closing_date === 'string' ? record.closing_date : '',
  final_balance: toNullableNumber(record.final_balance) ?? 0,
  total_income: toNullableNumber(record.total_income) ?? 0,
  total_payments: toNullableNumber(record.total_payments) ?? toNullableNumber(record.total_expenses) ?? 0,
  comments: typeof record.comments === 'string' ? record.comments : null,
  created_at: typeof record.created_at === 'string' ? record.created_at : null,
  updated_at: typeof record.updated_at === 'string' ? record.updated_at : null,
});

export const ClosingsProvider = ({ children }: { children: ReactNode }) => {
  const [closings, setClosings] = useCachedState<AccountingClosing[]>('accounting_closings', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setClosings(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setClosings]);

  const loadClosings = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/accounting_closings`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = await response.json();
      const normalized = Array.isArray(data?.accounting_closings)
        ? data.accounting_closings
            .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
            .map(normalizeClosing)
            .filter((item: AccountingClosing) => item.id > 0)
        : [];
      setClosings(sortByNewest(normalized, getDefaultSortValue));
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar cierres contables.');
        return;
      }
      console.error('Error loading accounting closings:', error);
    }
  }, [setClosings, token]);

  const addClosing = useCallback(
    async (payload: ClosingPayload): Promise<number | null> => {
      try {
        const response = await fetch(`${BASE_URL}/accounting_closings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const id = toNullableNumber(data?.closing_id);
        if (id !== null) {
          await loadClosings();
        }
        return id;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al crear un cierre contable.');
          return null;
        }
        console.error('Error adding closing:', error);
        return null;
      }
    },
    [loadClosings, token],
  );

  const updateClosing = useCallback(
    async (id: number, payload: ClosingPayload): Promise<boolean> => {
      try {
        const response = await fetch(`${BASE_URL}/accounting_closings/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        await ensureAuthResponse(response);
        if (response.ok) {
          await loadClosings();
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al actualizar un cierre contable.');
          return false;
        }
        console.error('Error updating closing:', error);
      }
      return false;
    },
    [loadClosings, token],
  );

  const deleteClosing = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${BASE_URL}/accounting_closings/${id}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        if (response.ok) {
          setClosings(prev => prev.filter(item => item.id !== id));
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al eliminar un cierre contable.');
          return false;
        }
        console.error('Error deleting closing:', error);
      }
      return false;
    },
    [setClosings, token],
  );

  const getClosingHistory = useCallback(
    async (id: number): Promise<AccountingClosingHistory[]> => {
      try {
        const response = await fetch(`${BASE_URL}/accounting_closings/${id}/history`, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        return Array.isArray(data?.history) ? data.history : [];
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al cargar historial de cierres.');
          return [];
        }
        console.error('Error loading closing history:', error);
        return [];
      }
    },
    [token],
  );

  return (
    <ClosingsContext.Provider value={{ closings, loadClosings, addClosing, updateClosing, deleteClosing, getClosingHistory }}>
      {children}
    </ClosingsContext.Provider>
  );
};
