import { BASE_URL } from '@/config/Index';

export interface Account {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JournalItem {
  account_id: number;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id: number;
  reference_type: 'invoice' | 'payment' | 'expense' | 'receipt' | 'manual';
  reference_id: number | string;
  date: string;
  memo?: string;
  items: JournalItem[];
  created_at?: string;
  updated_at?: string;
}

export interface LedgerItem {
  id: number;
  account_id: number;
  entry_id: number;
  date: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
}

interface ApiOptions {
  token: string;
}

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const fetchAccounts = async ({ token }: ApiOptions): Promise<Account[]> => {
  const response = await fetch(`${BASE_URL}/accounting/accounts`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Error cargando cuentas (${response.status})`);
  }
  const payload = await response.json();
  return (payload?.data ?? payload ?? []) as Account[];
};

export const fetchJournalEntries = async ({ token }: ApiOptions): Promise<JournalEntry[]> => {
  const response = await fetch(`${BASE_URL}/accounting/journal`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Error cargando asientos (${response.status})`);
  }
  const payload = await response.json();
  return (payload?.data ?? payload ?? []) as JournalEntry[];
};

export const saveJournalEntry = async (
  entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>,
  { token }: ApiOptions
): Promise<JournalEntry> => {
  const response = await fetch(`${BASE_URL}/accounting/journal`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(entry),
  });
  if (!response.ok) {
    throw new Error(`Error registrando asiento (${response.status})`);
  }
  const payload = await response.json();
  return (payload?.data ?? payload ?? {}) as JournalEntry;
};

export const fetchLedger = async (
  accountId: number,
  { token }: ApiOptions
): Promise<LedgerItem[]> => {
  const response = await fetch(`${BASE_URL}/accounting/ledger/${accountId}`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Error cargando mayor (${response.status})`);
  }
  const payload = await response.json();
  return (payload?.data ?? payload ?? []) as LedgerItem[];
};

export const fetchBalanceSheet = async ({ token }: ApiOptions) => {
  const response = await fetch(`${BASE_URL}/accounting/reports/balance`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Error cargando balance general (${response.status})`);
  }
  return response.json();
};

export const fetchIncomeStatement = async ({ token }: ApiOptions) => {
  const response = await fetch(`${BASE_URL}/accounting/reports/income`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Error cargando estado de resultados (${response.status})`);
  }
  return response.json();
};
