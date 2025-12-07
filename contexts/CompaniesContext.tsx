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
import { parseAdministratorIdsValue } from '@/utils/administratorIds';
import { toNumericCoordinate } from '@/utils/coordinates';
import { getCachedData, setCachedData } from '@/utils/cache';

export interface TaxIdentity {
  id?: number;
  type: string;
  value: string;
  country?: string | null;
  notes?: string | null;
  version?: number;
}

export interface CommunicationChannel {
  id?: number;
  type: string;
  value: string;
  label?: string | null;
  is_primary?: boolean;
  verified?: boolean;
  notes?: string | null;
  company_id?: number | null;
  contact_id?: number | null;
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
  latitude?: number | string | null;
  longitude?: number | string | null;
  label?: string | null;
  is_primary?: boolean;
  company_id?: number | null;
  version?: number;
}

export interface CompanyContact {
  id?: number;
  contact_id?: number;
  company_contact_id?: number;
  company_id?: number | null;
  name: string;
  last_name?: string | null;
  department?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  notes?: string | null;
  is_primary?: boolean;
  channels?: CommunicationChannel[];
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
  profile_file_id?: string | null;
  attached_files?: number[] | string | null;
  tax_identities: TaxIdentity[];
  addresses: CompanyAddress[];
  contacts: CompanyContact[];
  channels: CommunicationChannel[];
  administrator_ids?: string[];
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

const parseBooleanFlag = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['1', 'true', 'si', 'sí', 'yes', 'activo', 'activa', 'principal'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'inactivo', 'inactiva'].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const parseNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return null;
    }
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const parseTaxIdentity = (raw: any): TaxIdentity => {
  const type = pickString(raw?.type, raw?.tipo, raw?.name) ?? '';
  const typeKey = type.trim().toUpperCase();
  const directValue = pickString(raw?.value, raw?.valor, raw?.nro_doc);
  const numericCandidate = coerceToString(raw?.number);

  return {
    id: raw?.id,
    type,
    value: directValue ?? (numericCandidate && typeKey !== 'GWT' ? numericCandidate : '') ?? '',
    country: pickString(raw?.country, raw?.pais) ?? null,
    notes: pickString(raw?.notes, raw?.notas) ?? null,
    version:
      typeof raw?.version === 'number'
        ? raw.version
        : raw?.version
        ? Number(raw.version) || 1
        : undefined,
  };
};

const parseAddress = (raw: any): CompanyAddress => {
  const companyId = parseNumericId(raw?.company_id ?? raw?.empresa_id ?? raw?.companyId);
  const isPrimary = parseBooleanFlag(raw?.is_primary ?? raw?.es_principal);
  return {
    id: raw?.id ?? parseNumericId(raw?.address_id ?? raw?.company_address_id) ?? undefined,
    street: pickString(raw?.street, raw?.calle, raw?.address_line) ?? '',
    number: pickString(raw?.number, raw?.numero) ?? null,
    floor: pickString(raw?.floor, raw?.piso) ?? null,
    apartment: pickString(raw?.apartment, raw?.departamento, raw?.dpto) ?? null,
    city: pickString(raw?.city, raw?.ciudad, raw?.localidad) ?? null,
    state: pickString(raw?.state, raw?.provincia, raw?.state_name) ?? null,
    country: pickString(raw?.country, raw?.pais) ?? null,
    postal_code: pickString(raw?.postal_code, raw?.zip, raw?.codigo_postal) ?? null,
    notes: pickString(raw?.notes, raw?.notas) ?? null,
    latitude: toNumericCoordinate(
      raw?.latitude ?? raw?.lat ?? raw?.latitud ?? raw?.gps_latitude ?? raw?.gps_lat ?? raw?.gps?.lat
    ),
    longitude: toNumericCoordinate(
      raw?.longitude ??
        raw?.lng ??
        raw?.longitud ??
        raw?.gps_longitude ??
        raw?.gps_lng ??
        raw?.gps_lon ??
        raw?.gps?.lng ??
        raw?.gps?.lon
    ),
    label: pickString(raw?.label, raw?.etiqueta) ?? null,
    is_primary: typeof isPrimary === 'boolean' ? isPrimary : undefined,
    company_id: companyId,
    version:
      typeof raw?.version === 'number'
        ? raw.version
        : raw?.version
        ? Number(raw.version) || 1
        : undefined,
  };
};

const parseContact = (raw: any): CompanyContact => {
  const contactId = parseNumericId(raw?.contact_id ?? raw?.contacto_id ?? raw?.id);
  const companyContactId = parseNumericId(raw?.company_contact_id ?? raw?.pivot_id ?? raw?.id);
  const companyId = parseNumericId(raw?.company_id ?? raw?.empresa_id ?? raw?.companyId);
  const lastName = pickString(raw?.last_name, raw?.apellido);
  const firstName = pickString(raw?.first_name, raw?.nombre);
  const displayName = pickString(
    raw?.name,
    raw?.nombre_completo,
    raw?.full_name,
    [firstName, lastName].filter(Boolean).join(' ')
  );
  const isPrimary = parseBooleanFlag(raw?.is_primary ?? raw?.es_principal ?? raw?.principal);
  const parsedChannels = coalesceNestedArray(raw?.channels, raw?.contact_channels).map(parseChannel);

  return {
    id: contactId ?? companyContactId ?? raw?.id,
    contact_id: contactId ?? undefined,
    company_contact_id: companyContactId ?? undefined,
    company_id: companyId ?? undefined,
    name: displayName ?? firstName ?? '',
    last_name: lastName ?? null,
    department: pickString(raw?.department, raw?.departamento) ?? null,
    role: pickString(raw?.role, raw?.cargo, raw?.position) ?? null,
    email: pickString(raw?.email, raw?.correo, raw?.mail) ?? null,
    phone: pickString(raw?.phone, raw?.telefono) ?? null,
    mobile: pickString(raw?.mobile, raw?.celular) ?? null,
    notes: pickString(raw?.notes, raw?.notas) ?? null,
    is_primary: typeof isPrimary === 'boolean' ? isPrimary : undefined,
    channels: parsedChannels.map(channel => ({
      ...channel,
      contact_id: channel.contact_id ?? contactId ?? undefined,
    })),
    version:
      typeof raw?.version === 'number'
        ? raw.version
        : raw?.version
        ? Number(raw.version) || 1
        : undefined,
  };
};

const parseChannel = (raw: any): CommunicationChannel => {
  const companyId = parseNumericId(raw?.company_id ?? raw?.empresa_id ?? raw?.companyId);
  const contactId = parseNumericId(raw?.contact_id ?? raw?.contacto_id ?? raw?.contactId);
  const normalizedType = pickString(raw?.type, raw?.tipo, raw?.channel_type) ?? '';
  const normalizedValue = pickString(raw?.value, raw?.valor, raw?.dato) ?? '';
  const isPrimary = parseBooleanFlag(raw?.is_primary ?? raw?.es_principal);
  const verified = parseBooleanFlag(raw?.verified ?? raw?.verificado);
  return {
    id: raw?.id ?? parseNumericId(raw?.channel_id) ?? undefined,
    type: normalizedType,
    value: normalizedValue,
    label: pickString(raw?.label, raw?.etiqueta, raw?.tag) ?? null,
    is_primary: typeof isPrimary === 'boolean' ? isPrimary : undefined,
    verified: typeof verified === 'boolean' ? verified : undefined,
    notes: pickString(raw?.notes, raw?.notas, raw?.observaciones) ?? null,
    company_id: companyId,
    contact_id: contactId,
  };
};

const parseCompanyContactLink = (raw: any): CompanyContact => {
  const contactId = parseNumericId(raw?.contact_id ?? raw?.contacto_id);
  const companyContactId = parseNumericId(raw?.id ?? raw?.company_contact_id);
  const companyId = parseNumericId(raw?.company_id ?? raw?.empresa_id);
  const parsedChannels = coalesceNestedArray(raw?.channels).map(parseChannel);
  const isPrimary = parseBooleanFlag(raw?.is_primary ?? raw?.es_principal);

  return {
    id: contactId ?? companyContactId ?? raw?.id,
    contact_id: contactId ?? undefined,
    company_contact_id: companyContactId ?? undefined,
    company_id: companyId ?? undefined,
    name: pickString(raw?.name, raw?.nombre) ?? '',
    department: pickString(raw?.department, raw?.departamento) ?? null,
    role: pickString(raw?.role, raw?.cargo) ?? null,
    email: pickString(raw?.email, raw?.correo) ?? null,
    phone: pickString(raw?.phone, raw?.telefono) ?? null,
    mobile: pickString(raw?.mobile, raw?.celular) ?? null,
    notes: pickString(raw?.notes, raw?.notas) ?? null,
    is_primary: typeof isPrimary === 'boolean' ? isPrimary : undefined,
    channels: parsedChannels,
  };
};

const fetchCollectionWithParser = async (
  token: string,
  path: string,
  parser: any
): Promise<any[]> => {
  if (!token) {
    return [];
  }
  try {
    const response = await fetch(`${BASE_URL}/${path}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      return [];
    }
    const payload = await readJsonSafely(response);
    if (payload === null) {
      return [];
    }
    const collection = extractCollectionFromPayload(payload);
    return collection.map(parser);
  } catch (error) {
    console.error(`Error loading ${path}:`, error);
    return [];
  }
};

const extractCollectionFromPayload = (payload: any): any[] => {
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

const extractCompanyCollection = extractCollectionFromPayload;

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
  if (status) {
    const normalizedStatus = status.trim().toLowerCase();
    const activeLabels = ['active', 'activo', 'activa'];
    if (activeLabels.includes(normalizedStatus)) {
      status = null;
    }
  }
  const notes = pickString(raw?.notes, raw?.notas, raw?.observaciones);

  const profileFileSource =
    raw?.profile_file_id ?? raw?.file_profile_id ?? raw?.brandFileId ?? raw?.logo_id;
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

  const addresses = coalesceNestedArray(
    raw?.addresses,
    raw?.domicilios,
    raw?.address_list,
    raw?.direcciones,
    raw?.company_addresses
  ).map(
    parseAddress
  );
  const contacts = coalesceNestedArray(
    raw?.contacts,
    raw?.contactos,
    raw?.contact_list,
    raw?.personas_contacto,
    raw?.company_contacts
  ).map(parseContact);
  const channels = coalesceNestedArray(
    raw?.channels,
    raw?.company_channels,
    raw?.canales,
    raw?.communication_channels
  ).map(parseChannel);

  const administratorIds = parseAdministratorIdsValue(
    raw?.administrator_ids ??
      raw?.admin_users ??
      raw?.admin_ids ??
      raw?.administrator_id ??
      raw?.admin_id ??
      raw?.administradores ??
      raw?.administrador_id ??
      raw?.administratorIds ??
      raw?.adminUserIds ??
      raw?.admin_user_ids
  );

  return ensureCompanyCollections({
    id: typeof baseId === 'number' ? baseId : parseInt(baseId ?? '0', 10) || 0,
    name: displayName ?? '',
    legal_name: legalName ?? null,
    tax_id: taxId ?? null,
    website: website ?? null,
    phone: phone ?? null,
    email: email ?? null,
    status: status ?? null,
    notes: notes ?? null,
    profile_file_id:
      typeof profileFileSource === 'number' || typeof profileFileSource === 'string'
        ? String(profileFileSource)
        : null,
    attached_files:
      typeof attachedFilesSource === 'string'
        ? attachedFilesSource
        : attachedFilesSource
        ? JSON.stringify(attachedFilesSource)
        : null,
    tax_identities: taxIdentities,
    addresses,
    contacts,
    channels,
    administrator_ids: administratorIds,
    version: typeof rawVersion === 'number' ? rawVersion : parseInt(String(rawVersion ?? '1'), 10) || 1,
    created_at: pickString(raw?.created_at, raw?.creado_en, raw?.createdAt) ?? null,
    updated_at: pickString(raw?.updated_at, raw?.actualizado_en, raw?.updatedAt) ?? null,
  });
};

const mergeRecordCollections = <T extends Record<string, any>>(
  base: T[],
  incoming: T[],
  comparator: (a: T, b: T) => boolean
): T[] => {
  const merged = [...base];
  incoming.forEach(candidate => {
    const index = merged.findIndex(existing => comparator(existing, candidate));
    if (index >= 0) {
      merged[index] = { ...merged[index], ...candidate };
    } else {
      merged.push(candidate);
    }
  });
  return merged;
};

const normalizeComparableString = (value?: string | null) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const addressComparator = (a: CompanyAddress, b: CompanyAddress) => {
  if (a.id && b.id && a.id === b.id) {
    return true;
  }
  const sameStreet = normalizeComparableString(a.street) === normalizeComparableString(b.street);
  const sameNumber = normalizeComparableString(a.number) === normalizeComparableString(b.number);
  const sameCity = normalizeComparableString(a.city) === normalizeComparableString(b.city);
  const samePostal = normalizeComparableString(a.postal_code) === normalizeComparableString(b.postal_code);
  return sameStreet && sameNumber && sameCity && samePostal;
};

const contactComparator = (a: CompanyContact, b: CompanyContact) => {
  if (a.company_contact_id && b.company_contact_id && a.company_contact_id === b.company_contact_id) {
    return true;
  }
  if (a.contact_id && b.contact_id && a.contact_id === b.contact_id) {
    return true;
  }
  if (a.id && b.id && a.id === b.id) {
    return true;
  }
  const sameEmail =
    normalizeComparableString(a.email) !== '' &&
    normalizeComparableString(a.email) === normalizeComparableString(b.email);
  const samePhone =
    normalizeComparableString(a.phone) !== '' &&
    normalizeComparableString(a.phone) === normalizeComparableString(b.phone);
  return sameEmail || samePhone;
};

const channelComparator = (a: CommunicationChannel, b: CommunicationChannel) => {
  if (a.id && b.id && a.id === b.id) {
    return true;
  }
  const sameType = normalizeComparableString(a.type) === normalizeComparableString(b.type);
  const sameValue = normalizeComparableString(a.value) === normalizeComparableString(b.value);
  return sameType && sameValue;
};

const mergeChannels = (...collections: (CommunicationChannel[] | undefined)[]) =>
  collections.reduce<CommunicationChannel[]>((acc, collection) => {
    if (!collection?.length) {
      return acc;
    }
    return mergeRecordCollections(acc, collection, channelComparator);
  }, []);

const coerceNullableString = (value?: string | null) => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const duplicateAddressFields = (address: CompanyAddress) => {
  const street = coerceNullableString(address.street) ?? '';
  const number = coerceNullableString(address.number);
  const floor = coerceNullableString(address.floor);
  const apartment = coerceNullableString(address.apartment);
  const city = coerceNullableString(address.city);
  const state = coerceNullableString(address.state);
  const country = coerceNullableString(address.country);
  const postalCode = coerceNullableString(address.postal_code);
  const notes = coerceNullableString(address.notes);
  const label = coerceNullableString(address.label);
  const latitude = toNumericCoordinate(address.latitude);
  const longitude = toNumericCoordinate(address.longitude);
  const companyId = typeof address.company_id === 'number' ? address.company_id : null;
  const isPrimary =
    typeof address.is_primary === 'boolean'
      ? address.is_primary
      : typeof address.is_primary === 'number'
      ? address.is_primary === 1
      : null;

  const duplicated: Record<string, unknown> = {
    ...address,
    street,
    number,
    floor,
    apartment,
    city,
    state,
    country,
    postal_code: postalCode,
    notes,
    label,
    latitude,
    longitude,
    company_id: companyId,
    calle: street,
    numero: number,
    piso: floor,
    departamento: apartment,
    ciudad: city,
    provincia: state,
    pais: country,
    codigo_postal: postalCode,
    notas: notes,
    etiqueta: label,
    empresa_id: companyId,
    es_principal: isPrimary === null ? null : isPrimary ? 1 : 0,
    latitud: latitude,
    longitud: longitude,
    lat: latitude,
    lng: longitude,
    gps_latitude: latitude,
    gps_longitude: longitude,
  };

  if (address.id !== undefined) {
    duplicated.id = address.id;
    duplicated.address_id = address.id;
    duplicated.company_address_id = address.id;
  }

  if (address.version !== undefined) {
    duplicated.version = address.version;
  }

  return duplicated;
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
  const hasProfileFile = Object.prototype.hasOwnProperty.call(payload, 'profile_file_id');
  const hasAdministratorIds = Object.prototype.hasOwnProperty.call(payload, 'administrator_ids');

  const {
    name,
    tax_identities,
    addresses,
    contacts,
    attached_files,
    administrator_ids,
    version,
    profile_file_id,
    ...rest
  } = payload;

  const base = Object.entries(rest).reduce((acc, [key, value]) => {
    if (value === undefined) {
      return acc;
    }

    const normalizedValue =
      typeof value === 'string'
        ? (() => {
            const trimmed = value.trim();
            return trimmed.length ? trimmed : undefined;
          })()
        : value;

    if (normalizedValue === undefined) {
      return acc;
    }

    if (key === 'legal_name') {
      acc.legal_name = normalizedValue;
      acc.razon_social = normalizedValue;
      return acc;
    }

    if (key === 'tax_id') {
      acc.tax_id = normalizedValue;
      acc.nro_doc = normalizedValue;
      return acc;
    }

    acc[key] = normalizedValue;
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

  if (hasProfileFile) {
    const normalizedProfileFileId = (() => {
      if (profile_file_id === null || profile_file_id === '') {
        return null;
      }
      const numeric = Number(profile_file_id);
      return Number.isFinite(numeric) ? numeric : profile_file_id;
    })();

    if (normalizedProfileFileId !== undefined) {
      base.profile_file_id = normalizedProfileFileId;
      base.file_profile_id = normalizedProfileFileId;
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

  if (hasAdministratorIds) {
    if (administrator_ids === null) {
      base.administrator_ids = null;
    } else {
      base.administrator_ids = serializeNestedArray(administrator_ids ?? []);
    }
  }

  const nested: Record<string, unknown> = {};

  if (hasTaxIdentities) {
    const serialized = serializeNestedArray(tax_identities ?? []);
    nested.tax_identities = serialized;
    nested.tax_identifications = serialized;
  }

  if (hasAddresses) {
    const normalizedAddresses = Array.isArray(addresses)
      ? addresses.map(duplicateAddressFields)
      : addresses;
    const serializedAddresses = serializeNestedArray(normalizedAddresses ?? []);
    nested.addresses = serializedAddresses;
    nested.domicilios = serializedAddresses;
    nested.address_list = serializedAddresses;
    nested.direcciones = serializedAddresses;
    nested.company_addresses = serializedAddresses;
  }

  if (hasContacts) {
    const serializedContacts = serializeNestedArray(contacts ?? []);
    nested.contacts = serializedContacts;
    nested.contactos = serializedContacts;
    nested.contact_list = serializedContacts;
    nested.personas_contacto = serializedContacts;
    nested.company_contacts = serializedContacts;
  }

  return {
    ...base,
    ...nested,
  };
};

const ensureCompanyCollections = (company: Company): Company => ({
  ...company,
  addresses: Array.isArray(company.addresses) ? company.addresses : [],
  contacts: Array.isArray(company.contacts) ? company.contacts : [],
  channels: Array.isArray(company.channels) ? company.channels : [],
});

const ensureProfileType = (company: Company): Company => {
  if (
    company.profile_file_id === null ||
    company.profile_file_id === undefined ||
    typeof company.profile_file_id === 'string'
  ) {
    return company;
  }

  return {
    ...company,
    profile_file_id: String(company.profile_file_id),
  };
};

export const CompaniesProvider = ({ children }: { children: ReactNode }) => {
  const [companies, setCompanies] = useCachedState<Company[]>('companies', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setCompanies(prev => {
      const normalized = prev.map(company => {
        const withLegacy = company as Company & { file_profile_id?: unknown };
        const { file_profile_id: legacyFileProfileId, ...rest } = withLegacy;

        if (rest.profile_file_id !== undefined) {
          return ensureCompanyCollections(ensureProfileType(rest as Company));
        }

        const normalizedProfileId = (() => {
          const fallbackSource = legacyFileProfileId;
          if (fallbackSource === null || fallbackSource === undefined) {
            return null;
          }
          if (typeof fallbackSource === 'number' || typeof fallbackSource === 'string') {
            const trimmed = String(fallbackSource).trim();
            return trimmed.length ? trimmed : null;
          }
          return null;
        })();

        return ensureCompanyCollections(
          ensureProfileType({
            ...(rest as Company),
            profile_file_id: normalizedProfileId,
          })
        );
      });

      return ensureSortedByNewest(normalized, getDefaultSortValue);
    });
  }, [setCompanies]);

  const loadCompanies = useCallback(async () => {
    if (!token) {
      return;
    }

    let serverSucceeded = false;

    const hydrateFromCache = async () => {
      try {
        const cachedCompanies = await getCachedData<Company[]>('companies');
        if (!cachedCompanies || serverSucceeded) {
          return;
        }

        setCompanies(
          ensureSortedByNewest(
            cachedCompanies.map(company => ensureCompanyCollections(ensureProfileType(company))),
            getDefaultSortValue
          )
        );
      } catch (error) {
        console.error('Error hydrating companies from cache:', error);
      }
    };

    const fetchFromServer = async () => {
      try {
        const response = await fetch(`${BASE_URL}/companies`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await readJsonSafely(response);
        if (data === null) {
          if (response.ok) {
            setCompanies([]);
            await setCachedData('companies', []);
            serverSucceeded = true;
          }
          return;
        }

        const collection = extractCompanyCollection(data);
        const parsedCompanies = collection.map(parseCompany);

        const [addresses, contacts, companyContacts, companyChannels, contactChannels] = await Promise.all([
          fetchCollectionWithParser(token, 'company-addresses', parseAddress),
          fetchCollectionWithParser(token, 'contacts', parseContact),
          fetchCollectionWithParser(token, 'company-contacts', parseCompanyContactLink),
          fetchCollectionWithParser(token, 'company-channels', parseChannel),
          fetchCollectionWithParser(token, 'contact-channels', parseChannel),
        ]);

        const addressesByCompany = addresses.reduce<Map<number, CompanyAddress[]>>((acc, address) => {
          if (!address.company_id) {
            return acc;
          }
          const current = acc.get(address.company_id) ?? [];
          acc.set(address.company_id, [...current, address]);
          return acc;
        }, new Map());

        const companyChannelsByCompany = companyChannels.reduce<Map<number, CommunicationChannel[]>>(
          (acc, channel) => {
            if (!channel.company_id) {
              return acc;
            }
            const current = acc.get(channel.company_id) ?? [];
            acc.set(channel.company_id, mergeRecordCollections(current, [channel], channelComparator));
            return acc;
          },
          new Map()
        );

        const contactById = contacts.reduce<Map<number, CompanyContact>>((acc, contact) => {
          if (contact.id) {
            acc.set(contact.id, contact);
          }
          return acc;
        }, new Map());

        const contactChannelsByContact = contactChannels.reduce<Map<number, CommunicationChannel[]>>(
          (acc, channel) => {
            if (!channel.contact_id) {
              return acc;
            }
            const current = acc.get(channel.contact_id) ?? [];
            acc.set(channel.contact_id, mergeChannels(current, [channel]));
            return acc;
          },
          new Map()
        );

        const companyContactsByCompany = companyContacts.reduce<Map<number, CompanyContact[]>>(
          (acc, link) => {
            if (!link.company_id) {
              return acc;
            }
            const contactId = link.contact_id ?? link.id;
            const baseContact = contactId ? contactById.get(contactId) : undefined;
            const aggregatedChannels = mergeChannels(
              baseContact?.channels,
              link.channels,
              contactId ? contactChannelsByContact.get(contactId) : undefined
            );
            const normalizedName = (() => {
              const candidates = [
                link.name,
                baseContact?.name,
                [baseContact?.name, baseContact?.last_name].filter(Boolean).join(' '),
              ].filter(candidate => typeof candidate === 'string' && candidate.trim().length) as string[];
              return candidates.length ? candidates[0].trim() : '';
            })();
            const mergedContact: CompanyContact = {
              ...baseContact,
              ...link,
              id: contactId ?? link.company_contact_id ?? link.id ?? baseContact?.id,
              contact_id: contactId ?? baseContact?.contact_id,
              company_contact_id: link.company_contact_id ?? baseContact?.company_contact_id,
              company_id: link.company_id,
              name: normalizedName || baseContact?.name || '',
              channels: aggregatedChannels,
            };
            const current = acc.get(link.company_id) ?? [];
            acc.set(link.company_id, mergeRecordCollections(current, [mergedContact], contactComparator));
            return acc;
          },
          new Map()
        );

        const enriched = parsedCompanies.map(company => {
          const enrichedAddresses = mergeRecordCollections(
            company.addresses ?? [],
            addressesByCompany.get(company.id) ?? [],
            addressComparator
          );
          const enrichedCompanyChannels = mergeChannels(company.channels ?? [], companyChannelsByCompany.get(company.id));
          const linkedContacts = companyContactsByCompany.get(company.id) ?? [];
          const mergedContacts = mergeRecordCollections(company.contacts ?? [], linkedContacts, contactComparator).map(
            contact => {
              const contactId = contact.contact_id ?? contact.id;
              const aggregatedChannels = mergeChannels(
                contact.channels,
                contactId ? contactChannelsByContact.get(contactId) : undefined
              );
              return {
                ...contact,
                channels: aggregatedChannels,
              };
            }
          );

          return {
            ...company,
            addresses: enrichedAddresses,
            channels: enrichedCompanyChannels,
            contacts: mergedContacts,
          };
        });

        const sorted = sortByNewest(enriched, getDefaultSortValue);

        setCompanies(sorted);
        await setCachedData('companies', sorted);
        serverSucceeded = true;
      } catch (error) {
        console.error('Error loading companies:', error);
      }
    };

    await Promise.allSettled([hydrateFromCache(), fetchFromServer()]);
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
