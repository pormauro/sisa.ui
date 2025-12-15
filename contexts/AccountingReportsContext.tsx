import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { fetchBalanceSheet, fetchIncomeStatement } from '@/src/services/accounting';

interface AccountingReportsContextValue {
  balance: any;
  income: any;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const AccountingReportsContext = createContext<AccountingReportsContextValue>({
  balance: null,
  income: null,
  loading: false,
  refresh: async () => {},
});

export const AccountingReportsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const [balance, setBalance] = useCachedState<any>('balance_report', null);
  const [income, setIncome] = useCachedState<any>('income_report', null);
  const [loading, setLoading] = useCachedState<boolean>('accounting_reports_loading', false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [balanceData, incomeData] = await Promise.all([
        fetchBalanceSheet({ token }),
        fetchIncomeStatement({ token }),
      ]);
      setBalance(balanceData);
      setIncome(incomeData);
    } finally {
      setLoading(false);
    }
  }, [setBalance, setIncome, setLoading, token]);

  const value = useMemo(
    () => ({ balance, income, loading, refresh }),
    [balance, income, loading, refresh]
  );

  return <AccountingReportsContext.Provider value={value}>{children}</AccountingReportsContext.Provider>;
};
