export const SELECTION_KEYS = {
  receipts: {
    payerClient: 'receipts.payerClient',
    payerProvider: 'receipts.payerProvider',
    provider: 'receipts.provider',
  },
  payments: {
    creditorClient: 'payments.creditorClient',
    chargeClient: 'payments.chargeClient',
    creditorProvider: 'payments.creditorProvider',
  },
  jobs: {
    client: 'jobs.client',
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
