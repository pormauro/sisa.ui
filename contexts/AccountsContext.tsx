import React, { createContext, ReactNode, useCallback, useContext, useEffect } from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type AccountStatus = 'active' | 'archived';

export interface Account {
  id: number;
  company_id: number | null;
  name: string;
  code?: string | null;
  type: AccountType;
  description?: string | null;
  opening_balance?: number | null;
  current_balance?: number | null;
  status: AccountStatus;
  created_at?: string | null;
  updated_at?: string | null;
}

interface CreateAccountPayload {
  company_id?: number | null;
  name: string;
  code?: string | null;
  type: AccountType;
  description?: string | null;
  opening_balance?: number | null;
  status?: AccountStatus;
}

interface UpdateAccountPayload {
  company_id?: number | null;
  name?: string;
  code?: string | null;
  type?: AccountType;
  description?: string | null;
  opening_balance?: number | null;
  current_balance?: number | null;
  status?: AccountStatus;
}

interface AccountsContextValue {
  accounts: Account[];
  loadAccounts: (status?: AccountStatus | 'all') => Promise<void>;
  addAccount: (payload: CreateAccountPayload) => Promise<Account | null>;
  getAccount: (id: number) => Promise<Account | null>;
  updateAccount: (id: number, payload: UpdateAccountPayload) => Promise<Account | null>;
}

export const AccountsContext = createContext<AccountsContextValue>({
  accounts: [],
  loadAccounts: async () => {},
  addAccount: async () => null,
  getAccount: async () => null,
  updateAccount: async () => null,
});

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeAccount = (record: Record<string, unknown>): Account => ({
  id: toNullableNumber(record.id) ?? 0,
  company_id: toNullableNumber(record.company_id),
  name: typeof record.name === 'string' ? record.name : 'Cuenta',
  code: typeof record.code === 'string' ? record.code : null,
  type: (typeof record.type === 'string' ? record.type : 'asset') as AccountType,
  description: typeof record.description === 'string' ? record.description : null,
  opening_balance: toNullableNumber(record.opening_balance),
  current_balance:
    toNullableNumber(record.current_balance) ??
    toNullableNumber(record.balance) ??
    toNullableNumber(record.opening_balance),
  status: (typeof record.status === 'string' ? record.status : 'active') as AccountStatus,
  created_at: typeof record.created_at === 'string' ? record.created_at : null,
  updated_at: typeof record.updated_at === 'string' ? record.updated_at : null,
});

export const AccountsProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useCachedState<Account[]>('accounts', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setAccounts(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setAccounts]);

  const loadAccounts = useCallback(
    async (status: AccountStatus | 'all' = 'active') => {
      try {
        const query = status ? `?status=${status}` : '';
        const response = await fetch(`${BASE_URL}/accounts${query}`, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const raw = Array.isArray(data?.accounts) ? data.accounts : [];
        const normalized = raw
          .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map(normalizeAccount)
          .filter(account => account.id > 0);
        setAccounts(sortByNewest(normalized, getDefaultSortValue));
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al cargar cuentas contables.');
          return;
        }
        console.error('Error loading accounts:', error);
      }
    },
    [setAccounts, token],
  );

  const addAccount = useCallback(
    async (payload: CreateAccountPayload): Promise<Account | null> => {
      try {
        const response = await fetch(`${BASE_URL}/accounts`, {
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
        const raw = data?.account && typeof data.account === 'object' ? data.account : null;
        const created = raw ? normalizeAccount(raw as Record<string, unknown>) : null;
        if (created) {
          setAccounts(prev => ensureSortedByNewest([...prev.filter(item => item.id !== created.id), created], getDefaultSortValue));
          await loadAccounts('all');
          return created;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al crear una cuenta contable.');
          return null;
        }
        console.error('Error adding account:', error);
      }
      return null;
    },
    [loadAccounts, setAccounts, token],
  );

  const getAccount = useCallback(
    async (id: number): Promise<Account | null> => {
      try {
        const response = await fetch(`${BASE_URL}/accounts/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const raw = data?.account && typeof data.account === 'object' ? data.account : null;
        const account = raw ? normalizeAccount(raw as Record<string, unknown>) : null;
        if (account) {
          setAccounts(prev => ensureSortedByNewest([...prev.filter(item => item.id !== account.id), account], getDefaultSortValue));
        }
        return account;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al consultar una cuenta contable.');
          return null;
        }
        console.error('Error getting account:', error);
        return null;
      }
    },
    [setAccounts, token],
  );

  const updateAccount = useCallback(
    async (id: number, payload: UpdateAccountPayload): Promise<Account | null> => {
      try {
        const response = await fetch(`${BASE_URL}/accounts/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const raw = data?.account && typeof data.account === 'object' ? data.account : null;
        const updated = raw ? normalizeAccount(raw as Record<string, unknown>) : null;
        if (updated) {
          setAccounts(prev => ensureSortedByNewest([...prev.filter(item => item.id !== updated.id), updated], getDefaultSortValue));
          return updated;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al actualizar una cuenta contable.');
          return null;
        }
        console.error('Error updating account:', error);
      }
      return null;
    },
    [setAccounts, token],
  );

  return (
    <AccountsContext.Provider value={{ accounts, loadAccounts, addAccount, getAccount, updateAccount }}>
      {children}
    </AccountsContext.Provider>
  );
};
