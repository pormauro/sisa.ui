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

type MutableCompanyFields = Omit<Company, 'id' | 'name' | 'version' | 'created_at' | 'updated_at'>;

export type CompanyPayload = {
  name: string;
  version?: number;
} & Partial<MutableCompanyFields>;

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

const coerceToString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const pickString = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = coerceToString(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const coalesceNestedArray = (...candidates: unknown[]): any[] => {
  for (const candidate of candidates) {
    const parsed = parseNestedArray(candidate);
    if (parsed.length) {
      return parsed;
    }
  }
  return [];
};

const parseTaxIdentity = (raw: any): TaxIdentity => ({
  id: raw?.id,
  type: pickString(raw?.type, raw?.tipo, raw?.name) ?? '',
  value: pickString(raw?.value, raw?.valor, raw?.number, raw?.nro_doc) ?? '',
  country: pickString(raw?.country, raw?.pais) ?? null,
  notes: pickString(raw?.notes, raw?.notas) ?? null,
  version:
    typeof raw?.version === 'number'
      ? raw.version
      : raw?.version
      ? Number(raw.version) || 1
      : undefined,
});

const parseAddress = (raw: any): CompanyAddress => ({
  id: raw?.id,
  street: pickString(raw?.street, raw?.calle, raw?.address_line) ?? '',
  number: pickString(raw?.number, raw?.numero) ?? null,
  floor: pickString(raw?.floor, raw?.piso) ?? null,
  apartment: pickString(raw?.apartment, raw?.departamento, raw?.dpto) ?? null,
  city: pickString(raw?.city, raw?.ciudad, raw?.localidad) ?? null,
  state: pickString(raw?.state, raw?.provincia, raw?.state_name) ?? null,
  country: pickString(raw?.country, raw?.pais) ?? null,
  postal_code: pickString(raw?.postal_code, raw?.zip, raw?.codigo_postal) ?? null,
  notes: pickString(raw?.notes, raw?.notas) ?? null,
  version:
    typeof raw?.version === 'number'
      ? raw.version
      : raw?.version
      ? Number(raw.version) || 1
      : undefined,
});

const parseContact = (raw: any): CompanyContact => ({
  id: raw?.id,
  name: pickString(raw?.name, raw?.nombre, raw?.full_name) ?? '',
  role: pickString(raw?.role, raw?.cargo, raw?.position) ?? null,
  email: pickString(raw?.email, raw?.correo, raw?.mail) ?? null,
  phone: pickString(raw?.phone, raw?.telefono) ?? null,
  mobile: pickString(raw?.mobile, raw?.celular) ?? null,
  notes: pickString(raw?.notes, raw?.notas) ?? null,
  version:
    typeof raw?.version === 'number'
      ? raw.version
      : raw?.version
      ? Number(raw.version) || 1
      : undefined,
});

const extractCompanyCollection = (payload: any): any[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates: unknown[] = [
    payload?.companies,
    payload?.data,
    payload?.data?.companies,
    payload?.companies?.data,
    payload?.items,
    payload?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (typeof payload === 'object' && payload !== null) {
    const firstArrayValue = Object.values(payload as Record<string, unknown>).find(
      value => Array.isArray(value) && value.every(item => typeof item === 'object' && item !== null)
    );
    if (Array.isArray(firstArrayValue)) {
      return firstArrayValue;
    }
  }

  return [];
};

const parseCompany = (raw: any): Company => {
  const baseId = raw?.id ?? raw?.company_id;
  const rawVersion = raw?.version ?? raw?.version_number ?? raw?.__v ?? 1;

  const legalName = pickString(raw?.legal_name, raw?.razon_social, raw?.business_name);
  const displayName = pickString(raw?.name, raw?.nombre_fantasia, raw?.fantasy_name, legalName);
  const taxId = pickString(raw?.tax_id, raw?.cuit, raw?.document_number, raw?.nro_doc);
  const website = pickString(raw?.website, raw?.sitio_web, raw?.web);
  const phone = pickString(raw?.phone, raw?.telefono, raw?.telefono_principal);
  const email = pickString(raw?.email, raw?.correo_electronico, raw?.correo, raw?.mail);
  let status = pickString(raw?.status, raw?.estado);
  if (!status && raw?.activo !== undefined && raw?.activo !== null) {
    const isActive = raw.activo === true || raw.activo === 1 || raw.activo === '1';
    const isInactive = raw.activo === false || raw.activo === 0 || raw.activo === '0';
    status = isActive ? 'active' : isInactive ? 'inactive' : null;
  }
  const notes = pickString(raw?.notes, raw?.notas, raw?.observaciones);

  const brandFileSource = raw?.brand_file_id ?? raw?.brandFileId ?? raw?.logo_id;
  const attachedFilesSource = raw?.attached_files ?? raw?.archivos_adjuntos ?? raw?.adjuntos;

  const parsedTaxIdentities = coalesceNestedArray(
    raw?.tax_identities,
    raw?.tax_identifications,
    raw?.identidades_fiscales,
    raw?.identificaciones_fiscales,
    raw?.identities
  ).map(parseTaxIdentity);

  const taxIdentities: TaxIdentity[] = [...parsedTaxIdentities];

  if (taxId && !taxIdentities.some(identity => identity.value === taxId || identity.type?.toLowerCase() === 'cuit')) {
    taxIdentities.push({
      type: 'CUIT',
      value: taxId,
      country: null,
      notes: null,
      version: 1,
    });
  }

  const ivaCondition = pickString(raw?.condicion_iva, raw?.iva_condition, raw?.id_condicion_iva);
  if (
    ivaCondition &&
    !taxIdentities.some(identity => identity.type?.toLowerCase() === 'condición iva' && identity.value === ivaCondition)
  ) {
    taxIdentities.push({
      type: 'Condición IVA',
      value: ivaCondition,
      country: null,
      notes: null,
      version: 1,
    });
  }

  const iibb = pickString(raw?.iibb, raw?.ingresos_brutos);
  if (iibb && !taxIdentities.some(identity => identity.type?.toLowerCase() === 'iibb' && identity.value === iibb)) {
    taxIdentities.push({
      type: 'IIBB',
      value: iibb,
      country: null,
      notes: null,
      version: 1,
    });
  }

  const activityStart = pickString(raw?.inicio_actividad, raw?.activity_start_date);
  if (
    activityStart &&
    !taxIdentities.some(identity => identity.type?.toLowerCase() === 'inicio de actividad' && identity.value === activityStart)
  ) {
    taxIdentities.push({
      type: 'Inicio de actividad',
      value: activityStart,
      country: null,
      notes: null,
      version: 1,
    });
  }

  const addresses = coalesceNestedArray(raw?.addresses, raw?.domicilios, raw?.address_list, raw?.direcciones).map(
    parseAddress
  );
  const contacts = coalesceNestedArray(
    raw?.contacts,
    raw?.contactos,
    raw?.contact_list,
    raw?.personas_contacto
  ).map(parseContact);

  return {
    id: typeof baseId === 'number' ? baseId : parseInt(baseId ?? '0', 10) || 0,
    name: displayName ?? '',
    legal_name: legalName ?? null,
    tax_id: taxId ?? null,
    website: website ?? null,
    phone: phone ?? null,
    email: email ?? null,
    status: status ?? null,
    notes: notes ?? null,
    brand_file_id:
      typeof brandFileSource === 'number' || typeof brandFileSource === 'string' ? String(brandFileSource) : null,
    attached_files:
      typeof attachedFilesSource === 'string'
        ? attachedFilesSource
        : attachedFilesSource
        ? JSON.stringify(attachedFilesSource)
        : null,
    tax_identities: taxIdentities,
    addresses,
    contacts,
    version: typeof rawVersion === 'number' ? rawVersion : parseInt(String(rawVersion ?? '1'), 10) || 1,
    created_at: pickString(raw?.created_at, raw?.creado_en, raw?.createdAt) ?? null,
    updated_at: pickString(raw?.updated_at, raw?.actualizado_en, raw?.updatedAt) ?? null,
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
  const hasTaxIdentities = Object.prototype.hasOwnProperty.call(payload, 'tax_identities');
  const hasAddresses = Object.prototype.hasOwnProperty.call(payload, 'addresses');
  const hasContacts = Object.prototype.hasOwnProperty.call(payload, 'contacts');
  const hasAttachments = Object.prototype.hasOwnProperty.call(payload, 'attached_files');
  const hasBrandFile = Object.prototype.hasOwnProperty.call(payload, 'brand_file_id');

  const {
    name,
    tax_identities,
    addresses,
    contacts,
    attached_files,
    version,
    brand_file_id,
    ...rest
  } = payload;

  const base = Object.entries(rest).reduce((acc, [key, value]) => {
    if (value === undefined) {
      return acc;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {} as Record<string, unknown>);

  if (typeof name === 'string') {
    const trimmedName = name.trim();
    if (trimmedName) {
      base.nombre_fantasia = trimmedName;
    }
  }

  if (version !== undefined) {
    base.version = version;
  }

  if (hasBrandFile) {
    const normalizedBrandFileId = (() => {
      if (brand_file_id === null || brand_file_id === '') {
        return null;
      }
      const numeric = Number(brand_file_id);
      return Number.isFinite(numeric) ? numeric : brand_file_id;
    })();

    if (normalizedBrandFileId !== undefined) {
      base.brand_file_id = normalizedBrandFileId;
    }
  }

  if (hasAttachments) {
    const serializedAttachments =
      typeof attached_files === 'string'
        ? attached_files.trim() || null
        : attached_files
        ? JSON.stringify(attached_files)
        : attached_files === null
        ? null
        : undefined;

    if (serializedAttachments !== undefined) {
      base.attached_files = serializedAttachments;
    }
  }

  const nested: Record<string, unknown> = {};

  if (hasTaxIdentities) {
    const serialized = serializeNestedArray(tax_identities ?? []);
    nested.tax_identities = serialized;
    nested.tax_identifications = serialized;
  }

  if (hasAddresses) {
    nested.addresses = serializeNestedArray(addresses ?? []);
  }

  if (hasContacts) {
    nested.contacts = serializeNestedArray(contacts ?? []);
  }

  return {
    ...base,
    ...nested,
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
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJsonSafely(response);
      if (data !== null) {
        const collection = extractCompanyCollection(data);
        const parsed = collection.map(parseCompany);
        setCompanies(sortByNewest(parsed, getDefaultSortValue));
      } else if (response.ok) {
        setCompanies([]);
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
