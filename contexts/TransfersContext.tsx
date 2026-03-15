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
  getTransfer: (transferId: number) => Promise<TransferRecord | null>;
  getTransferEntries: (transferId: number) => Promise<Record<string, unknown>[]>;
}

export const TransfersContext = createContext<TransfersContextValue>({
  transfers: [],
  loading: false,
  loadTransfers: async () => [],
  createTransfer: async () => null,
  getTransfer: async () => null,
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

  const getTransfer = useCallback(
    async (transferId: number): Promise<TransferRecord | null> => {
      try {
        const response = await fetch(`${BASE_URL}/transfers/${transferId}`, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const transfer = data?.transfer as Record<string, unknown> | undefined;
        if (!transfer) {
          return null;
        }
        const normalized: TransferRecord = {
          id: toNullableNumber(transfer.id) ?? 0,
          origin_account_id: toNullableNumber(transfer.origin_account_id) ?? 0,
          destination_account_id: toNullableNumber(transfer.destination_account_id) ?? 0,
          amount: toNullableNumber(transfer.amount) ?? 0,
          transfer_date: typeof transfer.transfer_date === 'string' ? transfer.transfer_date : '',
          description: typeof transfer.description === 'string' ? transfer.description : null,
          company_id: toNullableNumber(transfer.company_id) ?? toNullableNumber((transfer.entries as any)?.origin?.company_id),
          origin_entry_id: toNullableNumber((transfer.entries as any)?.origin?.id),
          destination_entry_id: toNullableNumber((transfer.entries as any)?.destination?.id),
        };
        setTransfers(prev => [normalized, ...prev.filter(item => item.id !== normalized.id)]);
        return normalized;
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al consultar una transferencia.');
          return null;
        }
        console.error('Error loading transfer:', error);
        return null;
      }
    },
    [token],
  );

  const loadTransfers = useCallback(async (): Promise<TransferRecord[]> => {
    setLoading(true);
    try {
        const response = await fetch(`${BASE_URL}/transfers`, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const transfersData = Array.isArray(data?.transfers)
          ? data.transfers.filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          : [];
        const normalized = transfersData.map(transfer => ({
          id: toNullableNumber(transfer.id) ?? 0,
          origin_account_id: toNullableNumber(transfer.origin_account_id) ?? 0,
          destination_account_id: toNullableNumber(transfer.destination_account_id) ?? 0,
          amount: toNullableNumber(transfer.amount) ?? 0,
          transfer_date: typeof transfer.transfer_date === 'string' ? transfer.transfer_date : '',
          description: typeof transfer.description === 'string' ? transfer.description : null,
          company_id: toNullableNumber(transfer.company_id) ?? toNullableNumber((transfer.entries as any)?.origin?.company_id),
          origin_entry_id: toNullableNumber((transfer.entries as any)?.origin?.id),
          destination_entry_id: toNullableNumber((transfer.entries as any)?.destination?.id),
        }));
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
    <TransfersContext.Provider value={{ transfers, loading, loadTransfers, createTransfer, getTransfer, getTransferEntries }}>
      {children}
    </TransfersContext.Provider>
  );
};
