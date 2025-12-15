export type BootstrapSection = 'permissions' | 'companies' | 'memberCompanies' | 'categories' | 'invoices';

export type BootstrapSource = 'server' | 'cache' | 'skipped' | 'failed' | 'unknown';

export interface BootstrapResult {
  source?: BootstrapSource;
  error?: string | null;
}

export interface BootstrapStatusEntry {
  source: BootstrapSource;
  error: string | null;
  completedAt: number | null;
}

export type BootstrapStatus = Record<BootstrapSection, BootstrapStatusEntry>;

export const createInitialBootstrapStatus = (): BootstrapStatus => ({
  permissions: { source: 'unknown', error: null, completedAt: null },
  companies: { source: 'unknown', error: null, completedAt: null },
  memberCompanies: { source: 'unknown', error: null, completedAt: null },
  categories: { source: 'unknown', error: null, completedAt: null },
  invoices: { source: 'unknown', error: null, completedAt: null },
});
