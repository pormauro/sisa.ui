import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'expo-router';

import { AuthContext } from '@/contexts/AuthContext';
import {
  CompaniesContext,
  CompaniesProvider,
  Company,
} from '@/contexts/CompaniesContext';
import {
  CompanyMembershipsContext,
  CompanyMembershipsProvider,
} from '@/contexts/CompanyMembershipsContext';
import { ensureSortedByNewest, getDefaultSortValue } from '@/utils/sort';
import { setTrackedCompanyId } from '@/utils/auth/companyTracker';
import { getItem, removeItem, saveItem } from '@/utils/auth/secureStore';

interface CompanyContextValue {
  activeCompany: Company | null;
  setActiveCompany: (company: Company | null) => Promise<void>;
  companies: Company[];
  loadFromStorage: () => Promise<void>;
  saveToStorage: (companyId: number | null) => Promise<void>;
  openSelector: () => void;
}

const STORAGE_KEY = 'activeCompanyId';

const defaultContext: CompanyContextValue = {
  activeCompany: null,
  setActiveCompany: async () => {},
  companies: [],
  loadFromStorage: async () => {},
  saveToStorage: async () => {},
  openSelector: () => {},
};

export const CompanyContext = createContext<CompanyContextValue>(defaultContext);

const CompanyContextManager = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { companies: rawCompanies, loadCompanies } = useContext(CompaniesContext);
  const { loadMemberships } = useContext(CompanyMembershipsContext);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);
  const companiesRef = useRef<Company[]>([]);

  const isSuperUser = useMemo(() => userId === '1' || userId === 1, [userId]);

  useEffect(() => {
    companiesRef.current = companies;
  }, [companies]);

  const saveToStorage = useCallback(async (companyId: number | null) => {
    if (companyId) {
      await saveItem(STORAGE_KEY, String(companyId));
      return;
    }
    await removeItem(STORAGE_KEY);
  }, []);

  const getCompanyById = useCallback((companyId: number, catalogue?: Company[]): Company | null => {
    const source = catalogue ?? companiesRef.current;
    return source.find(company => company.id === companyId) ?? null;
  }, []);

  const filterAccessibleCompanies = useCallback(
    async (source: Company[]): Promise<Company[]> => {
      if (!source.length) {
        return [];
      }

      if (isSuperUser) {
        return ensureSortedByNewest(source, getDefaultSortValue);
      }

      const allowedCompanyIds = new Set<number>();
      await Promise.all(
        source.map(async company => {
          const memberships = await loadMemberships(company.id, 'approved');
          const belongs = memberships.some(membership => String(membership.user_id) === String(userId));
          if (belongs) {
            allowedCompanyIds.add(company.id);
          }
        }),
      );

      return ensureSortedByNewest(
        source.filter(company => allowedCompanyIds.has(company.id)),
        getDefaultSortValue,
      );
    },
    [isSuperUser, loadMemberships, userId],
  );

  const refreshCompanies = useCallback(async () => {
    const updatedCompanies = await loadCompanies();
    if (updatedCompanies && updatedCompanies.length) {
      return updatedCompanies;
    }

    if (companiesRef.current.length) {
      return companiesRef.current;
    }

    if (rawCompanies.length) {
      return rawCompanies;
    }

    return undefined;
  }, [loadCompanies, rawCompanies]);

  useEffect(() => {
    let cancelled = false;

    const synchronizeCompanies = async () => {
      const filtered = await filterAccessibleCompanies(rawCompanies);
      if (!cancelled) {
        setCompanies(filtered);
      }
    };

    synchronizeCompanies();

    return () => {
      cancelled = true;
    };
  }, [filterAccessibleCompanies, rawCompanies]);

  const validateCompanyAccess = useCallback(
    async (companyId: number | null, catalogue?: Company[]): Promise<Company | null> => {
      if (!companyId) {
        return null;
      }

      if (!companiesRef.current.length) {
        await refreshCompanies();
      }

      const company = getCompanyById(companyId, catalogue);
      if (!company) {
        return null;
      }

      if (isSuperUser) {
        return company;
      }

      const memberships = await loadMemberships(company.id, 'approved');
      const belongs = memberships.some(membership => String(membership.user_id) === String(userId));
      return belongs ? company : null;
    },
    [getCompanyById, isSuperUser, loadMemberships, refreshCompanies, userId],
  );

  const loadFromStorage = useCallback(async () => {
    const storedId = await getItem(STORAGE_KEY);
    const parsedId = storedId ? Number(storedId) : null;

    const freshCatalogue = await refreshCompanies();
    const sourceCatalogue = freshCatalogue ?? rawCompanies;
    const filtered = await filterAccessibleCompanies(sourceCatalogue);
    setCompanies(filtered);
    if (!filtered.length && sourceCatalogue.length === 0) {
      return;
    }
    const validCompany = await validateCompanyAccess(parsedId, filtered);
    if (validCompany) {
      setActiveCompanyState(validCompany);
      return;
    }
    setActiveCompanyState(null);
  }, [filterAccessibleCompanies, rawCompanies, refreshCompanies, validateCompanyAccess]);

  const setActiveCompany = useCallback(
    async (company: Company | null) => {
      if (!company) {
        setActiveCompanyState(null);
        await saveToStorage(null);
        return;
      }

      const validCompany = await validateCompanyAccess(company.id);
      if (validCompany) {
        setActiveCompanyState(validCompany);
        await saveToStorage(validCompany.id);
        return;
      }

      setActiveCompanyState(null);
    },
    [saveToStorage, validateCompanyAccess],
  );

  const openSelector = useCallback(() => {
    router.push('/companies');
  }, [router]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (activeCompany || !companies.length) {
      return;
    }

    const revalidateStoredSelection = async () => {
      const storedId = await getItem(STORAGE_KEY);
      const parsedId = storedId ? Number(storedId) : null;
      const validCompany = await validateCompanyAccess(parsedId, companies);
      if (validCompany) {
        setActiveCompanyState(validCompany);
      }
    };

    revalidateStoredSelection();
  }, [activeCompany, companies, validateCompanyAccess]);

  useEffect(() => {
    setTrackedCompanyId(activeCompany?.id ?? null);
  }, [activeCompany]);

  const value = useMemo(
    () => ({
      activeCompany,
      setActiveCompany,
      companies,
      loadFromStorage,
      saveToStorage,
      openSelector,
    }),
    [activeCompany, companies, loadFromStorage, openSelector, saveToStorage, setActiveCompany],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const CompanyProvider = ({ children }: { children: ReactNode }) => (
  <CompaniesProvider>
    <CompanyMembershipsProvider>
      <CompanyContextManager>{children}</CompanyContextManager>
    </CompanyMembershipsProvider>
  </CompaniesProvider>
);

export const useCompanyContext = () => useContext(CompanyContext);
