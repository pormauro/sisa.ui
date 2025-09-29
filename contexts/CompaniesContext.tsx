import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { BASE_URL } from '@/config/Index';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export interface TaxIdentity {
  id?: number;
  type: string;
  value: string;
  country?: string | null;
  notes?: string | null;
  version?: number;
}

export interface CompanyAddress {
  id?: number;
  street: string;
  number?: string | null;
  floor?: string | null;
  apartment?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  version?: number;
}

export interface CompanyContact {
  id?: number;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  notes?: string | null;
  version?: number;
}

export interface Company {
  id: number;
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  notes?: string | null;
  brand_file_id?: string | null;
  attached_files?: number[] | string | null;
  tax_identities: TaxIdentity[];
  addresses: CompanyAddress[];
  contacts: CompanyContact[];
  version: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export type CompanyPayload = Omit<
  Company,
  'id' | 'version' | 'created_at' | 'updated_at'
> & {
  version?: number;
};

interface CompaniesContextValue {
  companies: Company[];
  loadCompanies: () => void;
  addCompany: (company: CompanyPayload) => Promise<Company | null>;
  updateCompany: (id: number, company: CompanyPayload) => Promise<boolean>;
  deleteCompany: (id: number) => Promise<boolean>;
}

const defaultValue: CompaniesContextValue = {
  companies: [],
  loadCompanies: () => {},
  addCompany: async () => null,
  updateCompany: async () => false,
  deleteCompany: async () => false,
};

export const CompaniesContext = createContext<CompaniesContextValue>(defaultValue);

const readJsonSafely = async <T = any>(response: Response): Promise<T | null> => {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn('Unable to parse response JSON:', error);
    return null;
  }
};

const parseNestedArray = (value: unknown): any[] => {
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === 'object' && item !== null);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => typeof item === 'object' && item !== null);
        }
      } catch (error) {
        console.warn('Unable to parse nested block:', error);
      }
    }
  }
  return [];
};

const parseTaxIdentity = (raw: any): TaxIdentity => ({
  id: raw?.id,
  type: typeof raw?.type === 'string' ? raw.type : '',
  value: typeof raw?.value === 'string' ? raw.value : '',
  country: raw?.country ?? null,
  notes: raw?.notes ?? null,
  version: typeof raw?.version === 'number' ? raw.version : raw?.version ? Number(raw.version) || 1 : undefined,
});

const parseAddress = (raw: any): CompanyAddress => ({
  id: raw?.id,
  street: typeof raw?.street === 'string' ? raw.street : '',
  number: raw?.number ?? null,
  floor: raw?.floor ?? null,
  apartment: raw?.apartment ?? null,
  city: raw?.city ?? null,
  state: raw?.state ?? null,
  country: raw?.country ?? null,
  postal_code: raw?.postal_code ?? null,
  notes: raw?.notes ?? null,
  version: typeof raw?.version === 'number' ? raw.version : raw?.version ? Number(raw.version) || 1 : undefined,
});

const parseContact = (raw: any): CompanyContact => ({
  id: raw?.id,
  name: typeof raw?.name === 'string' ? raw.name : '',
  role: raw?.role ?? null,
  email: raw?.email ?? null,
  phone: raw?.phone ?? null,
  mobile: raw?.mobile ?? null,
  notes: raw?.notes ?? null,
  version: typeof raw?.version === 'number' ? raw.version : raw?.version ? Number(raw.version) || 1 : undefined,
});

const parseCompany = (raw: any): Company => {
  const baseId = raw?.id ?? raw?.company_id;
  const version = raw?.version ?? 1;

  return {
    id: typeof baseId === 'number' ? baseId : parseInt(baseId ?? '0', 10) || 0,
    name: typeof raw?.name === 'string' ? raw.name : '',
    legal_name: raw?.legal_name ?? null,
    tax_id: raw?.tax_id ?? null,
    website: raw?.website ?? null,
    phone: raw?.phone ?? null,
    email: raw?.email ?? null,
    status: raw?.status ?? null,
    notes: raw?.notes ?? null,
    brand_file_id:
      typeof raw?.brand_file_id === 'number' || typeof raw?.brand_file_id === 'string'
        ? String(raw.brand_file_id)
        : null,
    attached_files:
      typeof raw?.attached_files === 'string'
        ? raw.attached_files
        : raw?.attached_files
        ? JSON.stringify(raw.attached_files)
        : null,
    tax_identities: parseNestedArray(raw?.tax_identities ?? raw?.tax_identifications).map(parseTaxIdentity),
    addresses: parseNestedArray(raw?.addresses).map(parseAddress),
    contacts: parseNestedArray(raw?.contacts).map(parseContact),
    version: typeof version === 'number' ? version : parseInt(version ?? '1', 10) || 1,
    created_at: raw?.created_at ?? null,
    updated_at: raw?.updated_at ?? null,
  };
};

const serializeNestedArray = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value ?? []);
  } catch (error) {
    console.warn('Unable to serialize nested block:', error);
    return JSON.stringify([]);
  }
};

const serializeCompanyPayload = (payload: CompanyPayload) => {
  const {
    tax_identities,
    addresses,
    contacts,
    attached_files,
    version,
    brand_file_id,
    ...rest
  } = payload;

  const normalizedBrandFileId = (() => {
    if (brand_file_id === undefined || brand_file_id === null || brand_file_id === '') {
      return null;
    }
    const numeric = Number(brand_file_id);
    return Number.isFinite(numeric) ? numeric : brand_file_id;
  })();

  const base = {
    ...rest,
    ...(normalizedBrandFileId !== undefined ? { brand_file_id: normalizedBrandFileId } : {}),
  } as Record<string, unknown>;

  if (version !== undefined) {
    base.version = version;
  }

  const nested = {
    tax_identities: serializeNestedArray(tax_identities),
    tax_identifications: serializeNestedArray(tax_identities),
    addresses: serializeNestedArray(addresses),
    contacts: serializeNestedArray(contacts),
  };

  return {
    ...base,
    ...nested,
    attached_files:
      typeof attached_files === 'string'
        ? attached_files
        : attached_files
        ? JSON.stringify(attached_files)
        : null,
  };
};

export const CompaniesProvider = ({ children }: { children: ReactNode }) => {
  const [companies, setCompanies] = useCachedState<Company[]>('companies', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setCompanies(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setCompanies]);

  const loadCompanies = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJsonSafely<{ companies?: any[] }>(response);
      if (Array.isArray(data?.companies)) {
        const parsed = data.companies.map(parseCompany);
        setCompanies(sortByNewest(parsed, getDefaultSortValue));
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  }, [setCompanies, token]);

  const addCompany = useCallback(
    async (companyData: CompanyPayload): Promise<Company | null> => {
      if (!token) {
        return null;
      }

      try {
        const response = await fetch(`${BASE_URL}/companies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(serializeCompanyPayload(companyData)),
        });

        const data = await readJsonSafely<{ company?: any; company_id?: number | string }>(response);
        const newCompany = data?.company
          ? parseCompany(data.company)
          : parseCompany({ ...companyData, id: data?.company_id ?? Date.now() });

        if (newCompany.id) {
          setCompanies(prev =>
            ensureSortedByNewest([...prev.filter(c => c.id !== newCompany.id), newCompany], getDefaultSortValue)
          );
          await loadCompanies();
          return newCompany;
        }
      } catch (error) {
        console.error('Error adding company:', error);
      }
      return null;
    },
    [loadCompanies, setCompanies, token]
  );

  const updateCompany = useCallback(
    async (id: number, companyData: CompanyPayload): Promise<boolean> => {
      if (!token) {
        return false;
      }

      const serializedPayload = serializeCompanyPayload(companyData);
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      } as const;

      const performRequest = async (
        method: 'PUT' | 'PATCH' | 'POST',
        payload: Record<string, unknown>
      ) =>
        fetch(`${BASE_URL}/companies/${id}`, {
          method,
          headers,
          body: JSON.stringify(payload),
        });

      try {
        let response = await performRequest('PUT', serializedPayload);

        if (!response.ok && (response.status === 405 || response.status === 404)) {
          response = await performRequest('PATCH', serializedPayload);
        }

        if (!response.ok && response.status >= 400 && response.status < 500) {
          const fallbackPayload = {
            ...serializedPayload,
            _method: 'PUT',
            id,
            company_id: id,
          };
          response = await performRequest('POST', fallbackPayload);
        }

        if (!response.ok) {
          const errorPayload = await readJsonSafely(response);
          console.error('Error updating company:', {
            status: response.status,
            body: errorPayload,
          });
          return false;
        }

        let updatedCompany: Company | null = null;
        try {
          const payload = await readJsonSafely<{ company?: any }>(response);
          if (payload?.company) {
            updatedCompany = parseCompany(payload.company);
          }
        } catch (parseError) {
          // Some endpoints may return 204 without a body; ignore parse errors.
        }

        setCompanies(prev => {
          const existing = prev.find(company => company.id === id);
          const merged = updatedCompany ?? parseCompany({ ...(existing ?? {}), ...companyData, id });
          return ensureSortedByNewest(
            prev.map(company => (company.id === id ? merged : company)),
            getDefaultSortValue
          );
        });
        await loadCompanies();
        return true;
      } catch (error) {
        console.error('Error updating company:', error);
      }
      return false;
    },
    [loadCompanies, setCompanies, token]
  );

  const deleteCompany = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) {
        return false;
      }

      try {
        const response = await fetch(`${BASE_URL}/companies/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await readJsonSafely<{ message?: string; status?: string }>(response);
        const successMessage = data?.message ?? data?.status;
        if (response.ok && (successMessage || data === null)) {
          setCompanies(prev => prev.filter(company => company.id !== id));
          return true;
        }
      } catch (error) {
        console.error('Error deleting company:', error);
      }
      return false;
    },
    [setCompanies, token]
  );

  useEffect(() => {
    if (token) {
      loadCompanies();
    }
  }, [loadCompanies, token]);

  const value = useMemo(
    () => ({ companies, loadCompanies, addCompany, updateCompany, deleteCompany }),
    [addCompany, companies, deleteCompany, loadCompanies, updateCompany]
  );

  return <CompaniesContext.Provider value={value}>{children}</CompaniesContext.Provider>;
};

export const useCompanies = () => useContext(CompaniesContext);
