import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useCachedState } from '@/hooks/useCachedState';
import { useMemberCompanies } from '@/contexts/MemberCompaniesContext';
import type { Company } from '@/contexts/CompaniesContext';

interface CompanyScopeContextValue {
  selectedCompanyId: number | null;
  selectedCompany: Company | null;
  selectionHydrated: boolean;
  setSelectedCompanyId: (companyId: number | null) => void;
  clearCompanySelection: () => void;
}

const defaultContextValue: CompanyScopeContextValue = {
  selectedCompanyId: null,
  selectedCompany: null,
  selectionHydrated: false,
  setSelectedCompanyId: () => {},
  clearCompanySelection: () => {},
};

export const CompanyScopeContext = createContext<CompanyScopeContextValue>(defaultContextValue);

export const CompanyScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { memberCompanies } = useMemberCompanies();
  const [selectedCompanyId, setSelectedCompanyId, selectionHydrated] = useCachedState<number | null>(
    'selected-company-id',
    null,
  );

  const selectedCompany = useMemo(
    () => memberCompanies.find(company => company.id === selectedCompanyId) ?? null,
    [memberCompanies, selectedCompanyId],
  );

  useEffect(() => {
    if (!selectionHydrated) {
      return;
    }

    if (selectedCompanyId && !selectedCompany) {
      setSelectedCompanyId(null);
    }
  }, [selectedCompany, selectedCompanyId, selectionHydrated, setSelectedCompanyId]);

  const clearCompanySelection = useCallback(() => {
    setSelectedCompanyId(null);
  }, [setSelectedCompanyId]);

  const contextValue = useMemo(
    () => ({
      selectedCompanyId,
      selectedCompany,
      selectionHydrated,
      setSelectedCompanyId,
      clearCompanySelection,
    }),
    [clearCompanySelection, selectedCompany, selectedCompanyId, selectionHydrated, setSelectedCompanyId],
  );

  return <CompanyScopeContext.Provider value={contextValue}>{children}</CompanyScopeContext.Provider>;
};

export const useCompanyScope = (): CompanyScopeContextValue => useContext(CompanyScopeContext);
