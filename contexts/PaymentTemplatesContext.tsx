// /contexts/PaymentTemplatesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';
import { retryOnTokenExpiration } from '@/utils/auth/retry';

export interface PaymentTemplate {
  id: number;
  name: string;
  description?: string | null;
  default_amount?: number | null;
  default_category_id?: number | null;
  default_paid_with_account?: string | null;
  default_creditor_type: 'client' | 'provider' | 'other';
  default_creditor_client_id?: number | null;
  default_creditor_provider_id?: number | null;
  default_creditor_other?: string | null;
  default_charge_client?: boolean;
  default_charge_client_id?: number | null;
  icon_name?: string | null;
  default_payment_date?: string | null;
  attached_files?: number[];
  created_at?: string | null;
  updated_at?: string | null;
}

export type PaymentTemplateInput = {
  name: string;
  description?: string | null;
  default_amount?: number | null;
  default_category_id?: number | null;
  default_paid_with_account?: string | null;
  default_creditor_type: 'client' | 'provider' | 'other';
  default_creditor_client_id?: number | null;
  default_creditor_provider_id?: number | null;
  default_creditor_other?: string | null;
  default_charge_client?: boolean;
  default_charge_client_id?: number | null;
  icon_name?: string | null;
  default_payment_date?: string | null;
  attached_files?: number[] | null;
};

interface PaymentTemplatesContextValue {
  paymentTemplates: PaymentTemplate[];
  loadPaymentTemplates: () => void;
  addPaymentTemplate: (template: PaymentTemplateInput) => Promise<PaymentTemplate | null>;
  updatePaymentTemplate: (id: number, template: PaymentTemplateInput) => Promise<boolean>;
  deletePaymentTemplate: (id: number) => Promise<boolean>;
}

export const PaymentTemplatesContext = createContext<PaymentTemplatesContextValue>({
  paymentTemplates: [],
  loadPaymentTemplates: () => {},
  addPaymentTemplate: async () => null,
  updatePaymentTemplate: async () => false,
  deletePaymentTemplate: async () => false,
});

type RawTemplate = Record<string, unknown> | null | undefined;

const toSerializablePayload = (template: PaymentTemplateInput) => {
  const paidWithAccountRaw = template.default_paid_with_account ?? null;
  const paidWithAccountNumeric = toNullableNumber(paidWithAccountRaw ?? undefined);
  const creditorClientId = toNullableNumber(template.default_creditor_client_id);
  const creditorProviderId = toNullableNumber(template.default_creditor_provider_id);
  const chargeClientId = toNullableNumber(template.default_charge_client_id);
  const amount =
    typeof template.default_amount === 'number' ? template.default_amount : toNullableNumber(template.default_amount);
  const payload: Record<string, unknown> = {
    name: template.name,
    title: template.name,
    description: template.description ?? null,
    default_amount: amount,
    price: amount,
    default_category_id: template.default_category_id ?? null,
    category_id: template.default_category_id ?? null,
    default_paid_with_account: paidWithAccountRaw,
    default_creditor_type: template.default_creditor_type,
    creditor_type: template.default_creditor_type,
    default_creditor_client_id: creditorClientId,
    creditor_client_id: creditorClientId,
    default_creditor_provider_id: creditorProviderId,
    creditor_provider_id: creditorProviderId,
    default_creditor_other: template.default_creditor_other ?? null,
    creditor_other: template.default_creditor_other ?? null,
    default_charge_client: template.default_charge_client ?? false,
    charge_client: template.default_charge_client ?? false,
    default_charge_client_id: chargeClientId,
    charge_client_id: chargeClientId,
  };

  if (paidWithAccountNumeric !== null) {
    payload.paid_with_account = paidWithAccountNumeric;
  } else if (paidWithAccountRaw !== null) {
    payload.paid_with_account = paidWithAccountRaw;
  }

  if (typeof template.default_charge_client === 'boolean' && !template.default_charge_client) {
    payload.charge_client_id = null;
    payload.default_charge_client_id = null;
  }

  if (template.icon_name !== undefined) {
    payload.icon_name = template.icon_name;
  }

  if (template.default_payment_date !== undefined) {
    payload.default_payment_date = template.default_payment_date ?? null;
    payload.payment_date = template.default_payment_date ?? null;
  }

  if (template.attached_files !== undefined) {
    payload.attached_files = template.attached_files ?? null;
  }

  return payload;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
};

const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'si', 'sí'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
};

const parseAttachedFiles = (value: unknown): number[] => {
  if (value === null || typeof value === 'undefined') {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map(item => {
        const parsed = toNullableNumber(item);
        return parsed === null ? null : parsed;
      })
      .filter((item): item is number => item !== null);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseAttachedFiles(parsed);
    } catch (error) {
      console.warn('No se pudo interpretar attached_files de la plantilla de pago.', error);
      return [];
    }
  }
  return [];
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.warn('No se pudo interpretar la respuesta JSON de plantillas de pago.', error);
    return null;
  }
};

const getIdFromRaw = (raw: RawTemplate): number | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const candidates = ['id', 'payment_template_id', 'template_id'];
  for (const key of candidates) {
    if (key in raw) {
      const value = (raw as Record<string, unknown>)[key];
      const parsed = toNullableNumber(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  return null;
};

const getStringProperty = (data: RawTemplate, key: string): string | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
};

const getBooleanProperty = (data: RawTemplate, key: string): boolean | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const value = (data as Record<string, unknown>)[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return toBoolean(value);
  }
  return null;
};

const getIdFromLocationHeader = (response: Response): number | null => {
  const location = response.headers.get('Location') ?? response.headers.get('location');
  if (!location) {
    return null;
  }
  const match = /\/(\d+)(?:\D*$|$)/.exec(location);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickTemplateCandidate = (data: RawTemplate): RawTemplate => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  const candidates: RawTemplate[] = [
    record['payment_template'] as RawTemplate,
    record['paymentTemplate'] as RawTemplate,
    record['template'] as RawTemplate,
  ];
  const nestedSource = record['data'];
  if (nestedSource && typeof nestedSource === 'object') {
    const inner = nestedSource as Record<string, unknown>;
    candidates.push(
      inner['payment_template'] as RawTemplate,
      inner['paymentTemplate'] as RawTemplate,
      inner['template'] as RawTemplate
    );
  }
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }
  return null;
};

const normalizePaymentTemplate = (rawTemplate: RawTemplate): PaymentTemplate | null => {
  const id = getIdFromRaw(rawTemplate);
  if (id === null || !rawTemplate || typeof rawTemplate !== 'object') {
    return null;
  }
  const template = rawTemplate as Record<string, unknown>;
  const creditorTypeRaw =
    typeof template.default_creditor_type === 'string'
      ? template.default_creditor_type
      : typeof template.creditor_type === 'string'
      ? template.creditor_type
      : undefined;
  const normalizedCreditorType =
    creditorTypeRaw === 'client' || creditorTypeRaw === 'provider'
      ? (creditorTypeRaw as PaymentTemplate['default_creditor_type'])
      : 'other';

  return {
    id,
    name:
      toNullableString(template.name) ?? toNullableString(template.title) ?? '',
    description: toNullableString(template.description),
    default_amount: toNullableNumber(
      template.default_amount ?? template.amount ?? template.price
    ),
    default_category_id: toNullableNumber(
      template.default_category_id ?? template.category_id ?? template.categoryId
    ),
    default_paid_with_account: toNullableString(
      template.default_paid_with_account ?? template.paid_with_account
    ),
    default_creditor_type: normalizedCreditorType,
    default_creditor_client_id: toNullableNumber(
      template.default_creditor_client_id ?? template.creditor_client_id
    ),
    default_creditor_provider_id: toNullableNumber(
      template.default_creditor_provider_id ?? template.creditor_provider_id
    ),
    default_creditor_other: toNullableString(
      'default_creditor_other' in template
        ? template.default_creditor_other
        : template.creditor_other
    ),
    default_charge_client: toBoolean(
      'default_charge_client' in template ? template.default_charge_client : template.charge_client,
      false
    ),
    default_charge_client_id: toNullableNumber(
      template.default_charge_client_id ?? template.charge_client_id ?? template.client_id
    ),
    icon_name: toNullableString(template.icon_name ?? template.default_icon_name),
    default_payment_date: toNullableString(
      template.default_payment_date ?? template.payment_date ?? template.due_date
    ),
    attached_files: parseAttachedFiles(
      (template.attached_files as unknown) ??
        (template.default_attached_files as unknown) ??
        (template.attachments as unknown)
    ),
    created_at: toNullableString(template.created_at),
    updated_at: toNullableString(template.updated_at),
  };
};

const buildTemplateFromResponse = (
  response: Response,
  data: RawTemplate,
  payload: PaymentTemplateInput
): PaymentTemplate | null => {
  const candidate = pickTemplateCandidate(data);
  const templateBase: Record<string, unknown> = {
    ...payload,
    ...(candidate && typeof candidate === 'object' ? candidate : {}),
  };
  const explicitId = getIdFromRaw(candidate) ?? getIdFromRaw(data);
  const locationId = getIdFromLocationHeader(response);
  const resolvedId = explicitId ?? locationId;
  if (resolvedId === null) {
    return null;
  }
  templateBase.id = resolvedId;
  const normalized = normalizePaymentTemplate(templateBase);
  if (normalized) {
    return normalized;
  }
  return {
    id: resolvedId,
    ...payload,
  };
};

export const PaymentTemplatesProvider = ({ children }: { children: ReactNode }) => {
  const [paymentTemplates, setPaymentTemplates] = useCachedState<PaymentTemplate[]>(
    'paymentTemplates',
    []
  );
  const { token, checkConnection } = useContext(AuthContext);

  const runWithAuthRetry = useCallback(
    async <T>(operation: () => Promise<T>) =>
      retryOnTokenExpiration(operation, { onUnauthorized: () => checkConnection(true) }),
    [checkConnection]
  );

  useEffect(() => {
    setPaymentTemplates(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setPaymentTemplates]);

  const loadPaymentTemplates = useCallback(async () => {
    if (!token) {
      return;
    }
    const requestTemplates = async () => {
      const response = await fetch(`${BASE_URL}/payment_templates`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = (await parseJsonSafely(response)) as RawTemplate | RawTemplate[];
      let templatesRaw: RawTemplate[] | null = null;
      if (Array.isArray(data)) {
        templatesRaw = data;
      } else if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        const direct =
          (record['payment_templates'] as RawTemplate[]) ??
          (record['paymentTemplates'] as RawTemplate[]) ??
          (record['templates'] as RawTemplate[]);
        if (Array.isArray(direct)) {
          templatesRaw = direct as RawTemplate[];
        } else {
          const nestedSource = record['data'];
          if (nestedSource && typeof nestedSource === 'object') {
            const nestedRecord = nestedSource as Record<string, unknown>;
            const nested =
              (nestedRecord['payment_templates'] as RawTemplate[]) ??
              (nestedRecord['paymentTemplates'] as RawTemplate[]) ??
              (nestedRecord['templates'] as RawTemplate[]);
            if (Array.isArray(nested)) {
              templatesRaw = nested as RawTemplate[];
            }
          }
        }
      }
      if (Array.isArray(templatesRaw)) {
        const normalized = templatesRaw
          .map(template => normalizePaymentTemplate(template))
          .filter((template): template is PaymentTemplate => Boolean(template));
        setPaymentTemplates(sortByNewest(normalized, getDefaultSortValue));
      }
    };

    try {
      await runWithAuthRetry(requestTemplates);
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar plantillas de pago. Se solicitará un nuevo token.');
        return;
      }
      console.error('Error loading payment templates:', error);
    }
  }, [runWithAuthRetry, setPaymentTemplates, token]);

  const addPaymentTemplate = useCallback(
    async (template: PaymentTemplateInput): Promise<PaymentTemplate | null> => {
      if (!token) {
        return null;
      }
      try {
        return await runWithAuthRetry(async () => {
          const payload = toSerializablePayload(template);
          const response = await fetch(`${BASE_URL}/payment_templates`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          await ensureAuthResponse(response);
          const data = (await parseJsonSafely(response)) as RawTemplate;
          const newTemplate = buildTemplateFromResponse(response, data, payload);
          if (newTemplate) {
            setPaymentTemplates(prev =>
              ensureSortedByNewest([...prev, newTemplate], getDefaultSortValue)
            );
            await loadPaymentTemplates();
            return newTemplate;
          }
          return null;
        });
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al crear una plantilla de pago.');
          return null;
        }
        console.error('Error adding payment template:', error);
      }
      return null;
    },
    [loadPaymentTemplates, runWithAuthRetry, setPaymentTemplates, token]
  );

  const updatePaymentTemplate = useCallback(
    async (id: number, template: PaymentTemplateInput): Promise<boolean> => {
      if (!token) {
        return false;
      }
      try {
        return await runWithAuthRetry(async () => {
          const payload = toSerializablePayload(template);
          const response = await fetch(`${BASE_URL}/payment_templates/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          await ensureAuthResponse(response);
          const data = (await parseJsonSafely(response)) as RawTemplate;
          const updatedTemplate = buildTemplateFromResponse(response, data, payload);
          const message = getStringProperty(data, 'message');
          const normalizedMessage = message ? message.trim().toLowerCase() : null;
          const successFlag = getBooleanProperty(data, 'success') === true;
          const matchesVerboseMessage =
            normalizedMessage === 'payment template updated successfully' ||
            normalizedMessage === 'template updated successfully';
          const okWithShortMessage = response.ok && normalizedMessage === 'template updated';
          const hasNoPayload = data === null || typeof data === 'undefined';
          const isSuccess =
            successFlag ||
            Boolean(updatedTemplate) ||
            matchesVerboseMessage ||
            okWithShortMessage ||
            (response.ok && hasNoPayload);
          if (isSuccess) {
            setPaymentTemplates(prev =>
              ensureSortedByNewest(
                prev.map(templateItem =>
                  templateItem.id === id
                    ? updatedTemplate ?? { ...templateItem, ...payload, id }
                    : templateItem
                ),
                getDefaultSortValue
              )
            );
            await loadPaymentTemplates();
            return true;
          }
          return false;
        });
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al actualizar una plantilla de pago.');
          return false;
        }
        console.error('Error updating payment template:', error);
      }
      return false;
    },
    [loadPaymentTemplates, runWithAuthRetry, setPaymentTemplates, token]
  );

  const deletePaymentTemplate = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) {
        return false;
      }
      try {
        return await runWithAuthRetry(async () => {
          const response = await fetch(`${BASE_URL}/payment_templates/${id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          await ensureAuthResponse(response);
          const data = (await parseJsonSafely(response)) as RawTemplate;
          const message = getStringProperty(data, 'message');
          const normalizedMessage = message ? message.trim().toLowerCase() : null;
          const successFlag = getBooleanProperty(data, 'success') === true;
          const matchesVerboseMessage =
            normalizedMessage === 'payment template deleted successfully' ||
            normalizedMessage === 'template deleted successfully';
          const okWithShortMessage = response.ok && normalizedMessage === 'template deleted';
          const hasNoPayload = data === null || typeof data === 'undefined';
          const isSuccess =
            successFlag || matchesVerboseMessage || okWithShortMessage || (response.ok && hasNoPayload);
          if (isSuccess) {
            setPaymentTemplates(prev => prev.filter(templateItem => templateItem.id !== id));
            return true;
          }
          return false;
        });
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al eliminar una plantilla de pago.');
          return false;
        }
        console.error('Error deleting payment template:', error);
      }
      return false;
    },
    [runWithAuthRetry, setPaymentTemplates, token]
  );

  useEffect(() => {
    if (token) {
      void loadPaymentTemplates();
    }
  }, [loadPaymentTemplates, token]);

  return (
    <PaymentTemplatesContext.Provider
      value={{
        paymentTemplates,
        loadPaymentTemplates,
        addPaymentTemplate,
        updatePaymentTemplate,
        deletePaymentTemplate,
      }}
    >
      {children}
    </PaymentTemplatesContext.Provider>
  );
};

