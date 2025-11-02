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
  created_at?: string | null;
  updated_at?: string | null;
}

export type PaymentTemplateInput = Omit<
  PaymentTemplate,
  'id' | 'created_at' | 'updated_at'
>;

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

const toSerializablePayload = (template: PaymentTemplateInput) => ({
  ...template,
});

export const PaymentTemplatesProvider = ({ children }: { children: ReactNode }) => {
  const [paymentTemplates, setPaymentTemplates] = useCachedState<PaymentTemplate[]>(
    'paymentTemplates',
    []
  );
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setPaymentTemplates(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setPaymentTemplates]);

  const loadPaymentTemplates = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/payment_templates`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = await response.json();
      const templates =
        data?.payment_templates ?? data?.paymentTemplates ?? data?.templates ?? null;
      if (Array.isArray(templates)) {
        setPaymentTemplates(sortByNewest(templates, getDefaultSortValue));
      }
    } catch (error) {
      if (isTokenExpiredError(error)) {
        console.warn('Token expirado al cargar plantillas de pago. Se solicitará un nuevo token.');
        return;
      }
      console.error('Error loading payment templates:', error);
    }
  }, [setPaymentTemplates, token]);

  const addPaymentTemplate = useCallback(
    async (template: PaymentTemplateInput): Promise<PaymentTemplate | null> => {
      if (!token) {
        return null;
      }
      try {
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
        const data = await response.json();
        const createdId =
          data?.payment_template_id ?? data?.template_id ?? data?.id ?? data?.paymentTemplateId;
        if (createdId !== undefined && createdId !== null) {
          const newTemplate: PaymentTemplate = {
            id: Number(createdId),
            ...payload,
          };
          setPaymentTemplates(prev =>
            ensureSortedByNewest([...prev, newTemplate], getDefaultSortValue)
          );
          await loadPaymentTemplates();
          return newTemplate;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al crear una plantilla de pago.');
          return null;
        }
        console.error('Error adding payment template:', error);
      }
      return null;
    },
    [loadPaymentTemplates, setPaymentTemplates, token]
  );

  const updatePaymentTemplate = useCallback(
    async (id: number, template: PaymentTemplateInput): Promise<boolean> => {
      if (!token) {
        return false;
      }
      try {
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
        const data = await response.json();
        const isSuccess =
          data?.message === 'Payment template updated successfully' ||
          data?.message === 'Template updated successfully' ||
          data?.success === true;
        if (isSuccess) {
          setPaymentTemplates(prev =>
            ensureSortedByNewest(
              prev.map(templateItem =>
                templateItem.id === id ? { ...templateItem, ...payload } : templateItem
              ),
              getDefaultSortValue
            )
          );
          await loadPaymentTemplates();
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al actualizar una plantilla de pago.');
          return false;
        }
        console.error('Error updating payment template:', error);
      }
      return false;
    },
    [loadPaymentTemplates, setPaymentTemplates, token]
  );

  const deletePaymentTemplate = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) {
        return false;
      }
      try {
        const response = await fetch(`${BASE_URL}/payment_templates/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        await ensureAuthResponse(response);
        const data = await response.json();
        const isSuccess =
          data?.message === 'Payment template deleted successfully' ||
          data?.message === 'Template deleted successfully' ||
          data?.success === true;
        if (isSuccess) {
          setPaymentTemplates(prev => prev.filter(templateItem => templateItem.id !== id));
          return true;
        }
      } catch (error) {
        if (isTokenExpiredError(error)) {
          console.warn('Token expirado al eliminar una plantilla de pago.');
          return false;
        }
        console.error('Error deleting payment template:', error);
      }
      return false;
    },
    [setPaymentTemplates, token]
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

