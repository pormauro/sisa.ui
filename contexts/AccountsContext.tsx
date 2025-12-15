import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { Account, fetchAccounts } from '@/src/services/accounting';

interface AccountsContextValue {
  accounts: Account[];
  loading: boolean;
  refresh: () => Promise<void>;
  findAccount: (id: number) => Account | undefined;
}

export const AccountsContext = createContext<AccountsContextValue>({
  accounts: [],
  loading: false,
  refresh: async () => {},
  findAccount: () => undefined,
});

export const AccountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const [accounts, setAccounts, hydrated] = useCachedState<Account[]>('accounts', []);
  const [loading, setLoading] = useCachedState<boolean>('accounts_loading', false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchAccounts({ token });
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, [setAccounts, setLoading, token]);

  useEffect(() => {
    if (!hydrated || !token) return;
    void refresh();
  }, [hydrated, refresh, token]);

  const findAccount = useCallback((id: number) => accounts.find((item) => item.id === id), [accounts]);

  const value = useMemo(
    () => ({ accounts, loading, refresh, findAccount }),
    [accounts, loading, refresh, findAccount]
  );

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>;
};
