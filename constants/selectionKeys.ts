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
  paymentTemplates: {
    creditorClient: 'paymentTemplates.creditorClient',
    chargeClient: 'paymentTemplates.chargeClient',
    creditorProvider: 'paymentTemplates.creditorProvider',
    cashBox: 'paymentTemplates.cashBox',
    category: 'paymentTemplates.category',
  },
  jobs: {
    client: 'jobs.client',
    tariff: 'jobs.tariff',
    status: 'jobs.status',
    folder: 'jobs.folder',
  },
  clients: {
    tariff: 'clients.tariff',
  },
  appointments: {
    client: 'appointments.client',
    job: 'appointments.job',
  },
  folders: {
    client: 'folders.client',
  },
} as const;

type SelectionGroups = typeof SELECTION_KEYS;
type SelectionGroup = SelectionGroups[keyof SelectionGroups];
export type SelectionKey = SelectionGroup[keyof SelectionGroup];
