import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { LedgerItem, fetchLedger } from '@/src/services/accounting';

interface LedgerContextValue {
  ledgers: Record<number, LedgerItem[]>;
  loadingAccountId: number | null;
  loadLedger: (accountId: number) => Promise<void>;
}

export const LedgerContext = createContext<LedgerContextValue>({
  ledgers: {},
  loadingAccountId: null,
  loadLedger: async () => {},
});

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const [ledgerCache, setLedgerCache] = useCachedState<Record<number, LedgerItem[]>>('ledger', {});
  const [loadingAccountId, setLoadingAccountId] = useState<number | null>(null);

  const loadLedger = useCallback(
    async (accountId: number) => {
      if (!token) return;
      setLoadingAccountId(accountId);
      try {
        const data = await fetchLedger(accountId, { token });
        setLedgerCache((prev) => ({ ...prev, [accountId]: data }));
      } finally {
        setLoadingAccountId(null);
      }
    },
    [setLedgerCache, token]
  );

  const value = useMemo(
    () => ({ ledgers: ledgerCache, loadingAccountId, loadLedger }),
    [ledgerCache, loadLedger, loadingAccountId]
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};
