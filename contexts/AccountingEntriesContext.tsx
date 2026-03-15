import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';

export type AccountingEntryType = 'debit' | 'credit';

export interface AccountingEntry {
  id: number;
  company_id?: number | null;
  account_id: number;
  entry_date: string;
  description?: string | null;
  amount: number;
  entry_type: AccountingEntryType;
  origin_type?: string | null;
  origin_id?: number | null;
  user_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AccountingEntryFilters {
  account_id?: number;
  start_date?: string;
  end_date?: string;
  origin_type?: string;
  origin_id?: number;
  entry_type?: AccountingEntryType;
  page?: number;
  per_page?: number;
  sort_by?: 'entry_date' | 'amount' | 'id' | 'created_at';
  sort_direction?: 'asc' | 'desc';
}

export interface AccountingEntriesResult {
  entries: AccountingEntry[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
  totals: {
    debit: number;
    credit: number;
    net: number;
  };
}

interface AccountingEntriesContextValue {
  entries: AccountingEntry[];
  lastResult: AccountingEntriesResult | null;
  loading: boolean;
  loadEntries: (filters?: AccountingEntryFilters) => Promise<AccountingEntriesResult | null>;
}

export const AccountingEntriesContext = createContext<AccountingEntriesContextValue>({
  entries: [],
  lastResult: null,
  loading: false,
  loadEntries: async () => null,
});

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeEntry = (record: Record<string, unknown>): AccountingEntry => ({
  id: toNullableNumber(record.id) ?? 0,
  company_id: toNullableNumber(record.company_id),
  account_id: toNullableNumber(record.account_id) ?? 0,
  entry_date: typeof record.entry_date === 'string' ? record.entry_date : '',
  description: typeof record.description === 'string' ? record.description : null,
  amount: toNullableNumber(record.amount) ?? 0,
  entry_type: (record.entry_type === 'credit' ? 'credit' : 'debit') as AccountingEntryType,
  origin_type: typeof record.origin_type === 'string' ? record.origin_type : null,
  origin_id: toNullableNumber(record.origin_id),
  user_id: toNullableNumber(record.user_id),
  created_at: typeof record.created_at === 'string' ? record.created_at : null,
  updated_at: typeof record.updated_at === 'string' ? record.updated_at : null,
});

const buildQueryString = (filters?: AccountingEntryFilters): string => {
  const params = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const AccountingEntriesProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [lastResult, setLastResult] = useState<AccountingEntriesResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadEntries = useCallback(
    async (filters?: AccountingEntryFilters): Promise<AccountingEntriesResult | null> => {
      setLoading(true);
      try {
        const response = await fetch(`${BASE_URL}/accounting-entries${buildQueryString(filters)}`, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const normalizedEntries = Array.isArray(data?.entries)
          ? data.entries
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
              .map(normalizeEntry)
              .filter(item => item.id > 0)
          : [];
        const result: AccountingEntriesResult = {
          entries: normalizedEntries,
          pagination: {
            page: toNullableNumber(data?.pagination?.page) ?? 1,
            per_page: toNullableNumber(data?.pagination?.per_page) ?? filters?.per_page ?? 50,
            total_entries: toNullableNumber(data?.pagination?.total_entries) ?? normalizedEntries.length,
            total_pages: toNullableNumber(data?.pagination?.total_pages) ?? 1,
          },
          totals: {
            debit: toNullableNumber(data?.totals?.debit) ?? 0,
            credit: toNullableNumber(data?.totals?.credit) ?? 0,
            net: toNullableNumber(data?.totals?.net) ?? 0,
          },
        };
        setEntries(normalizedEntries);
        setLastResult(result);
        return result;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al cargar asientos contables.');
          return null;
        }
        console.error('Error loading accounting entries:', error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  return (
    <AccountingEntriesContext.Provider value={{ entries, lastResult, loading, loadEntries }}>
      {children}
    </AccountingEntriesContext.Provider>
  );
};
