import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import { InvoicesContext } from '@/contexts/InvoicesContext';
import { MemberCompaniesContext } from '@/contexts/MemberCompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

interface BootstrapContextValue {
  isBootstrapping: boolean;
  isReady: boolean;
  lastError: string | null;
  refreshBootstrap: () => Promise<void>;
}

const defaultValue: BootstrapContextValue = {
  isBootstrapping: false,
  isReady: false,
  lastError: null,
  refreshBootstrap: async () => {},
};

export const BootstrapContext = createContext<BootstrapContextValue>(defaultValue);

export const BootstrapProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, isLoading: authIsLoading } = useContext(AuthContext);
  const { loadCompanies } = useContext(CompaniesContext);
  const { loadMemberCompanies } = useContext(MemberCompaniesContext);
  const { refreshPermissions } = useContext(PermissionsContext);
  const { loadCategories } = useContext(CategoriesContext);
  const { loadInvoices } = useContext(InvoicesContext);

  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const bootstrapTokenRef = useRef<string | null>(null);

  const runBootstrap = useCallback(async () => {
    if (!token) {
      setIsReady(false);
      setLastError(null);
      return;
    }

    setIsBootstrapping(true);
    setLastError(null);

    try {
      await Promise.all([
        refreshPermissions(),
        loadCompanies(),
        loadMemberCompanies(),
        loadCategories(),
        loadInvoices(),
      ]);
    } catch (error) {
      console.error('Error during bootstrap sequence:', error);
      setLastError(
        error instanceof Error ? error.message : 'No fue posible cargar los datos base de la sesión.'
      );
    } finally {
      setIsBootstrapping(false);
      setIsReady(true);
    }
  }, [loadCategories, loadCompanies, loadInvoices, loadMemberCompanies, refreshPermissions, token]);

  useEffect(() => {
    if (authIsLoading) {
      return;
    }

    if (!token) {
      bootstrapTokenRef.current = null;
      setIsReady(false);
      setIsBootstrapping(false);
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
      refreshBootstrap: runBootstrap,
    }),
    [isBootstrapping, isReady, lastError, runBootstrap]
  );

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
};
