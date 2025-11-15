import { CompanyAddress } from '@/contexts/CompaniesContext';
import { toNumericCoordinate } from '@/utils/coordinates';

export const createEmptyCompanyAddress = (): CompanyAddress => ({
  street: '',
  number: '',
  floor: '',
  apartment: '',
  city: '',
  state: '',
  country: '',
  postal_code: '',
  notes: '',
  latitude: null,
  longitude: null,
});

export const sanitizeCompanyAddressDrafts = (items: CompanyAddress[]): CompanyAddress[] =>
  items
    .map(address => {
      const latitude = toNumericCoordinate(address.latitude);
      const longitude = toNumericCoordinate(address.longitude);
      const sanitized: CompanyAddress = {
        street: address.street.trim(),
        number: address.number?.toString().trim() || null,
        floor: address.floor?.toString().trim() || null,
        apartment: address.apartment?.toString().trim() || null,
        city: address.city?.toString().trim() || null,
        state: address.state?.toString().trim() || null,
        country: address.country?.toString().trim() || null,
        postal_code: address.postal_code?.toString().trim() || null,
        notes: address.notes?.toString().trim() || null,
        latitude,
        longitude,
      };

      if (address.label !== undefined) {
        sanitized.label = address.label;
      }
      if (address.is_primary !== undefined) {
        sanitized.is_primary = address.is_primary;
      }
      if (address.id !== undefined) {
        sanitized.id = address.id;
      }
      if (address.version !== undefined) {
        sanitized.version = address.version;
      }

      return sanitized;
    })
    .filter(address => {
      const hasText = address.street || address.city || address.country;
      const hasCoordinates = typeof address.latitude === 'number' && typeof address.longitude === 'number';
      return hasText || hasCoordinates;
    });

export const coordinateInputValue = (value: string | number | null | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
};

export const buildCompanyAddressPayload = (companyId: number, address: CompanyAddress) => {
  const [sanitized] = sanitizeCompanyAddressDrafts([address]);
  if (!sanitized) {
    return null;
  }

  const latitude = toNumericCoordinate(sanitized.latitude);
  const longitude = toNumericCoordinate(sanitized.longitude);
  const isPrimary = typeof sanitized.is_primary === 'boolean' ? sanitized.is_primary : false;

  return {
    empresa_id: companyId,
    etiqueta: sanitized.label ?? null,
    pais: sanitized.country ?? null,
    provincia: sanitized.state ?? null,
    ciudad: sanitized.city ?? null,
    calle: sanitized.street,
    numero: sanitized.number ?? null,
    piso: sanitized.floor ?? null,
    departamento: sanitized.apartment ?? null,
    codigo_postal: sanitized.postal_code ?? null,
    notas: sanitized.notes ?? null,
    es_principal: isPrimary ? 1 : 0,
    latitud: latitude,
    longitud: longitude,
  };
};
