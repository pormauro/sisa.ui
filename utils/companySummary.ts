export interface CompanySummary {
  id: number;
  business_name: string;
  fantasy_name: string;
  tax_id: string;
  email: string;
  profile_file_id: string | null;
  document_type_id: number | null;
  iva_condition_id: number | null;
  active: number | null;
}

export const coerceToNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const normalizeStringValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
};

export const normalizeOptionalStringValue = (value: unknown): string => {
  const normalized = normalizeStringValue(value);
  return normalized.length ? normalized : '';
};

export const normalizeNullableStringValue = (value: unknown): string | null => {
  const normalized = normalizeStringValue(value);
  return normalized.length ? normalized : null;
};

export const parseCompanySummary = (raw: any): CompanySummary | null => {
  const id = coerceToNumber(raw?.id);
  if (!id) {
    return null;
  }
  return {
    id,
    business_name: normalizeOptionalStringValue(raw?.business_name ?? raw?.razon_social),
    fantasy_name: normalizeOptionalStringValue(raw?.fantasy_name ?? raw?.nombre_fantasia),
    tax_id: normalizeOptionalStringValue(raw?.tax_id ?? raw?.nro_doc),
    email: normalizeOptionalStringValue(raw?.email),
    profile_file_id: normalizeNullableStringValue(
      raw?.profile_file_id ?? raw?.file_profile_id ?? raw?.brand_file_id
    ),
    document_type_id: coerceToNumber(raw?.document_type_id ?? raw?.id_tipo_doc),
    iva_condition_id: coerceToNumber(raw?.iva_condition_id ?? raw?.id_condicion_iva),
    active: coerceToNumber(raw?.active ?? raw?.activo),
  };
};

export const getCompanyDisplayName = (company: CompanySummary | null): string => {
  if (!company) {
    return '';
  }
  const businessName = company.business_name?.trim() ?? '';
  const fantasy = company.fantasy_name?.trim() ?? '';
  return businessName || fantasy || `Empresa #${company.id}`;
};
