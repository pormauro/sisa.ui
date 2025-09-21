export const SELECTION_KEYS = {
  receipts: {
    payerClient: 'receipts.payerClient',
    payerProvider: 'receipts.payerProvider',
    provider: 'receipts.provider',
    cashBox: 'receipts.cashBox',
    category: 'receipts.category',
  },
  payments: {
    creditorClient: 'payments.creditorClient',
    chargeClient: 'payments.chargeClient',
    creditorProvider: 'payments.creditorProvider',
    cashBox: 'payments.cashBox',
    category: 'payments.category',
  },
  jobs: {
    client: 'jobs.client',
    tariff: 'jobs.tariff',
  },
  clients: {
    tariff: 'clients.tariff',
  },
  appointments: {
    client: 'appointments.client',
  },
  folders: {
    client: 'folders.client',
  },
} as const;

type SelectionGroups = typeof SELECTION_KEYS;
type SelectionGroup = SelectionGroups[keyof SelectionGroups];
export type SelectionKey = SelectionGroup[keyof SelectionGroup];
