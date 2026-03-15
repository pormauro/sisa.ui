import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';

export interface TransferRecord {
  id: number;
  origin_account_id: number;
  destination_account_id: number;
  amount: number;
  transfer_date: string;
  description?: string | null;
  company_id?: number | null;
  origin_entry_id?: number | null;
  destination_entry_id?: number | null;
}

interface TransferPayload {
  origin_account_id: number;
  destination_account_id: number;
  amount: number;
  transfer_date?: string;
  description?: string | null;
}

interface TransfersContextValue {
  transfers: TransferRecord[];
  loading: boolean;
  loadTransfers: () => Promise<TransferRecord[]>;
  createTransfer: (payload: TransferPayload) => Promise<TransferRecord | null>;
  getTransferEntries: (transferId: number) => Promise<Record<string, unknown>[]>;
}

export const TransfersContext = createContext<TransfersContextValue>({
  transfers: [],
  loading: false,
  loadTransfers: async () => [],
  createTransfer: async () => null,
  getTransferEntries: async () => [],
});

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeGroupedTransfers = (entries: Record<string, unknown>[]): TransferRecord[] => {
  const grouped = new Map<number, TransferRecord>();

  entries.forEach(entry => {
    const transferId = toNullableNumber(entry.origin_id);
    if (transferId === null) return;

    const current = grouped.get(transferId) ?? {
      id: transferId,
      origin_account_id: 0,
      destination_account_id: 0,
      amount: toNullableNumber(entry.amount) ?? 0,
      transfer_date: typeof entry.entry_date === 'string' ? entry.entry_date : '',
      description: typeof entry.description === 'string' ? entry.description : null,
      company_id: toNullableNumber(entry.company_id),
      origin_entry_id: null,
      destination_entry_id: null,
    };

    if (entry.entry_type === 'credit') {
      current.origin_account_id = toNullableNumber(entry.account_id) ?? current.origin_account_id;
      current.origin_entry_id = toNullableNumber(entry.id);
    }
    if (entry.entry_type === 'debit') {
      current.destination_account_id = toNullableNumber(entry.account_id) ?? current.destination_account_id;
      current.destination_entry_id = toNullableNumber(entry.id);
    }

    grouped.set(transferId, current);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const aTime = Date.parse(a.transfer_date.replace(' ', 'T')) || 0;
    const bTime = Date.parse(b.transfer_date.replace(' ', 'T')) || 0;
    return bTime - aTime;
  });
};

export const TransfersProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const getTransferEntries = useCallback(
    async (transferId: number) => {
      try {
        const response = await fetch(
          `${BASE_URL}/accounting-entries?origin_type=transfer&origin_id=${transferId}&per_page=200&sort_by=entry_date&sort_direction=desc`,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        await ensureAuthResponse(response);
        const data = await response.json();
        return Array.isArray(data?.entries) ? data.entries : [];
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al cargar asientos de transferencia.');
          return [];
        }
        console.error('Error loading transfer entries:', error);
        return [];
      }
    },
    [token],
  );

  const loadTransfers = useCallback(async (): Promise<TransferRecord[]> => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BASE_URL}/accounting-entries?origin_type=transfer&per_page=200&sort_by=entry_date&sort_direction=desc`,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );
      await ensureAuthResponse(response);
      const data = await response.json();
      const entries = Array.isArray(data?.entries)
        ? data.entries.filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        : [];
      const normalized = normalizeGroupedTransfers(entries);
      setTransfers(normalized);
      return normalized;
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar transferencias.');
        return [];
      }
      console.error('Error loading transfers:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createTransfer = useCallback(
    async (payload: TransferPayload): Promise<TransferRecord | null> => {
      try {
        const response = await fetch(`${BASE_URL}/transfers`, {
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
        const transfer = data?.transfer as Record<string, unknown> | undefined;
        const origin = data?.entries?.origin as Record<string, unknown> | undefined;
        const destination = data?.entries?.destination as Record<string, unknown> | undefined;
        if (transfer) {
          const created: TransferRecord = {
            id: toNullableNumber(transfer.id) ?? 0,
            origin_account_id: toNullableNumber(transfer.origin_account_id) ?? payload.origin_account_id,
            destination_account_id: toNullableNumber(transfer.destination_account_id) ?? payload.destination_account_id,
            amount: toNullableNumber(transfer.amount) ?? payload.amount,
            transfer_date: typeof transfer.transfer_date === 'string' ? transfer.transfer_date : payload.transfer_date ?? '',
            description: typeof transfer.description === 'string' ? transfer.description : payload.description ?? null,
            company_id: toNullableNumber(origin?.company_id) ?? toNullableNumber(destination?.company_id),
            origin_entry_id: toNullableNumber(origin?.id),
            destination_entry_id: toNullableNumber(destination?.id),
          };
          setTransfers(prev => [created, ...prev.filter(item => item.id !== created.id)]);
          return created;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al crear una transferencia.');
          return null;
        }
        console.error('Error creating transfer:', error);
      }
      return null;
    },
    [token],
  );

  return (
    <TransfersContext.Provider value={{ transfers, loading, loadTransfers, createTransfer, getTransferEntries }}>
      {children}
    </TransfersContext.Provider>
  );
};
