import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { AuthContext } from '@/contexts/AuthContext';
import { AccountsContext } from '@/contexts/AccountsContext';
import { useCachedState } from '@/hooks/useCachedState';
import { JournalEntry, JournalItem, fetchJournalEntries, saveJournalEntry } from '@/src/services/accounting';

interface JournalEntriesContextValue {
  entries: JournalEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
  createEntry: (entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<JournalEntry | null>;
  findByReference: (type: JournalEntry['reference_type'], referenceId: number | string) => JournalEntry[];
}

const sumSide = (items: JournalItem[], key: 'debit' | 'credit') =>
  items.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);

const validateEntry = (items: JournalItem[], accountExists: (id: number) => boolean): boolean => {
  const debit = sumSide(items, 'debit');
  const credit = sumSide(items, 'credit');
  if (Math.abs(debit - credit) > 0.001) {
    Alert.alert('Asiento inválido', 'El asiento debe tener débitos y créditos iguales.');
    return false;
  }

  const invalidAccount = items.find((item) => !accountExists(item.account_id));
  if (invalidAccount) {
    Alert.alert('Cuenta obligatoria', 'Todos los renglones deben referenciar una cuenta contable válida.');
    return false;
  }

  return true;
};

export const JournalEntriesContext = createContext<JournalEntriesContextValue>({
  entries: [],
  loading: false,
  refresh: async () => {},
  createEntry: async () => null,
  findByReference: () => [],
});

export const JournalEntriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const { findAccount } = useContext(AccountsContext);
  const [entries, setEntries, hydrated] = useCachedState<JournalEntry[]>('journal_entries', []);
  const [loading, setLoading] = useCachedState<boolean>('journal_entries_loading', false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchJournalEntries({ token });
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [setEntries, setLoading, token]);

  useEffect(() => {
    if (!hydrated || !token) return;
    void refresh();
  }, [hydrated, refresh, token]);

  const createEntry = useCallback(
    async (entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>) => {
      if (!token) return null;
      if (!validateEntry(entry.items, (id) => Boolean(findAccount(id)))) {
        return null;
      }
      const persisted = await saveJournalEntry(entry, { token });
      setEntries((prev) => [persisted, ...prev]);
      return persisted;
    },
    [findAccount, setEntries, token]
  );

  const findByReference = useCallback(
    (type: JournalEntry['reference_type'], referenceId: number | string) =>
      entries.filter((entry) => entry.reference_type === type && String(entry.reference_id) === String(referenceId)),
    [entries]
  );

  const value = useMemo(
    () => ({ entries, loading, refresh, createEntry, findByReference }),
    [entries, loading, refresh, createEntry, findByReference]
  );

  return <JournalEntriesContext.Provider value={value}>{children}</JournalEntriesContext.Provider>;
};
