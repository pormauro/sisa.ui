import { useCallback, useContext, useMemo } from 'react';
import { InvoicesContext, type Invoice } from '@/contexts/InvoicesContext';

const normalizeStatus = (status?: string | null): string => {
  if (!status) {
    return 'draft';
  }
  return status.trim().toLowerCase();
};

const getInvoiceAmount = (invoice: Invoice): number => {
  const totalAmount = invoice?.total_amount;
  if (typeof totalAmount === 'number' && Number.isFinite(totalAmount)) {
    return totalAmount;
  }
  if (typeof totalAmount === 'string') {
    const parsed = Number(totalAmount.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
};

export interface ClientInvoiceSummary {
  issuedTotal: number;
  draftTotal: number;
  totalAmount: number;
  issuedCount: number;
  draftCount: number;
}

const EMPTY_SUMMARY: ClientInvoiceSummary = {
  issuedTotal: 0,
  draftTotal: 0,
  totalAmount: 0,
  issuedCount: 0,
  draftCount: 0,
};

const ensureNumericClientId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export function useClientInvoiceSummary() {
  const { invoices } = useContext(InvoicesContext);

  const summaries = useMemo(() => {
    const map = new Map<number, ClientInvoiceSummary>();

    invoices.forEach(invoice => {
      const clientId = ensureNumericClientId(invoice.client_id);
      if (clientId === null) {
        return;
      }

      const status = normalizeStatus(invoice.status);
      if (status !== 'draft' && status !== 'issued') {
        return;
      }

      const amount = getInvoiceAmount(invoice);
      let entry = map.get(clientId);
      if (!entry) {
        entry = { ...EMPTY_SUMMARY };
        map.set(clientId, entry);
      }

      if (status === 'issued') {
        entry.issuedTotal += amount;
        entry.issuedCount += 1;
      } else {
        entry.draftTotal += amount;
        entry.draftCount += 1;
      }

      entry.totalAmount = entry.issuedTotal + entry.draftTotal;
    });

    return map;
  }, [invoices]);

  const getSummary = useCallback(
    (clientId: number): ClientInvoiceSummary => summaries.get(clientId) ?? { ...EMPTY_SUMMARY },
    [summaries]
  );

  const hasInvoicesForClient = useCallback(
    (clientId: number) => {
      const entry = summaries.get(clientId);
      if (!entry) {
        return false;
      }
      return entry.issuedCount > 0 || entry.draftCount > 0;
    },
    [summaries]
  );

  return { getSummary, hasInvoicesForClient };
}
