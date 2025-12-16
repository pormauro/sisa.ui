import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import { InvoicesContext } from '@/contexts/InvoicesContext';
import { MemberCompaniesContext } from '@/contexts/MemberCompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import {
  BootstrapResult,
  BootstrapSection,
  BootstrapStatus,
  createInitialBootstrapStatus,
} from '@/contexts/bootstrapTypes';

interface BootstrapContextValue {
  isBootstrapping: boolean;
  isReady: boolean;
  lastError: string | null;
  status: BootstrapStatus;
  refreshBootstrap: () => Promise<void>;
}

const defaultValue: BootstrapContextValue = {
  isBootstrapping: false,
  isReady: false,
  lastError: null,
  status: createInitialBootstrapStatus(),
  refreshBootstrap: async () => {},
};

export const BootstrapContext = createContext<BootstrapContextValue>(defaultValue);

export const BootstrapProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, isLoading: authIsLoading } = useContext(AuthContext);
  const { loadCompanies } = useContext(CompaniesContext);
  const { loadMemberCompaniesWithStatus } = useContext(MemberCompaniesContext);
  const { refreshPermissions } = useContext(PermissionsContext);
  const { loadCategories } = useContext(CategoriesContext);
  const { loadInvoices } = useContext(InvoicesContext);

  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [status, setStatus] = useState<BootstrapStatus>(createInitialBootstrapStatus());
  const bootstrapTokenRef = useRef<string | null>(null);

  const setSectionStatus = useCallback(
    (section: BootstrapSection, result: BootstrapResult, startedAt: number) => {
      const source = result.source ?? 'server';
      const error = result.error ?? null;
      setStatus(prev => ({
        ...prev,
        [section]: {
          source,
          error,
          completedAt: startedAt,
        },
      }));
      if (source === 'failed' && !lastError) {
        setLastError(error ?? 'No fue posible cargar los datos base de la sesión.');
      }
    },
    [lastError]
  );

  const runSection = useCallback(
    async (section: BootstrapSection, loader: () => Promise<BootstrapResult>) => {
      const startedAt = Date.now();
      const result = await loader().catch((error: unknown) => ({
        source: 'failed' as const,
        error: error instanceof Error ? error.message : 'No fue posible completar el arranque.',
      }));
      setSectionStatus(section, result, startedAt);
      return result;
    },
    [setSectionStatus]
  );

  const runBootstrap = useCallback(async () => {
    const markSkipped = () => {
      const completedAt = Date.now();
      setStatus({
        permissions: { source: 'skipped', error: null, completedAt },
        companies: { source: 'skipped', error: null, completedAt },
        memberCompanies: { source: 'skipped', error: null, completedAt },
        categories: { source: 'skipped', error: null, completedAt },
        invoices: { source: 'skipped', error: null, completedAt },
      });
      setLastError(null);
      setIsBootstrapping(false);
      setIsReady(true);
    };

    if (!token) {
      markSkipped();
      return;
    }

    setIsBootstrapping(true);
    setLastError(null);
    setStatus(createInitialBootstrapStatus());

    await Promise.all([
      runSection('permissions', refreshPermissions),
      runSection('companies', loadCompanies),
      runSection('memberCompanies', loadMemberCompaniesWithStatus),
      runSection('categories', loadCategories),
      runSection('invoices', loadInvoices),
    ]);

    setIsBootstrapping(false);
    setIsReady(true);
  }, [
    loadCategories,
    loadCompanies,
    loadInvoices,
    loadMemberCompaniesWithStatus,
    refreshPermissions,
    runSection,
    token,
  ]);

  useEffect(() => {
    if (authIsLoading) {
      return;
    }

    if (!token) {
      bootstrapTokenRef.current = null;
      void runBootstrap();
      return;
    }

    if (bootstrapTokenRef.current === token && isReady) {
      return;
    }

    bootstrapTokenRef.current = token;
    void runBootstrap();
  }, [authIsLoading, isReady, runBootstrap, token]);

  const value = useMemo(
    () => ({
      isBootstrapping,
      isReady,
      lastError,
      status,
      refreshBootstrap: runBootstrap,
    }),
    [isBootstrapping, isReady, lastError, runBootstrap, status]
  );

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
};
