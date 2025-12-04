import React, { createContext, useCallback, useContext, useMemo } from 'react';

import { useCachedState } from '@/hooks/useCachedState';
import { CompaniesContext, type Company } from '@/contexts/CompaniesContext';

interface SelectedCompanyContextValue {
  selectedCompanyId: number | null;
  selectedCompany: Company | null;
  hydrated: boolean;
  selectCompany: (companyId: number | null) => void;
}

const defaultValue: SelectedCompanyContextValue = {
  selectedCompanyId: null,
  selectedCompany: null,
  hydrated: false,
  selectCompany: () => {},
};

const SelectedCompanyContext = createContext<SelectedCompanyContextValue>(defaultValue);

export const SelectedCompanyProvider = ({ children }: { children: React.ReactNode }) => {
  const { companies } = useContext(CompaniesContext);
  const [selectedCompanyId, setSelectedCompanyId, hydrated] = useCachedState<number | null>(
    'selected_company_id',
    null,
  );

  const selectCompany = useCallback(
    (companyId: number | null) => {
      setSelectedCompanyId(companyId);
    },
    [setSelectedCompanyId],
  );

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) {
      return null;
    }

    return companies.find((company) => company.id === selectedCompanyId) ?? null;
  }, [companies, selectedCompanyId]);

  return (
    <SelectedCompanyContext.Provider
      value={{ selectedCompanyId, selectedCompany, hydrated, selectCompany }}
    >
      {children}
    </SelectedCompanyContext.Provider>
  );
};

export const useSelectedCompany = () => useContext(SelectedCompanyContext);
