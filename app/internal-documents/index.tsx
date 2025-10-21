import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import {
  AfipInvoiceForm,
  FACTURA_X_VOUCHER_TYPE,
} from '@/components/invoices/AfipInvoiceForm';
import { CreateAfipInvoicePayload } from '@/contexts/InvoicesContext';

const InternalDocumentsScreen: React.FC = () => {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (_payload: CreateAfipInvoicePayload) => {
      Alert.alert(
        'Comprobante interno preparado',
        'Los datos del comprobante interno fueron copiados al portapapeles. Utilízalos en la API para registrarlo.',
        [
          {
            text: 'Aceptar',
            onPress: () => router.back(),
          },
        ]
      );
    },
    [router]
  );

  return (
    <AfipInvoiceForm
      onSubmit={handleSubmit}
      submitLabel="Generar comprobante interno"
      onCancel={() => router.back()}
      allowedVoucherTypes={[FACTURA_X_VOUCHER_TYPE]}
      defaultVoucherType={FACTURA_X_VOUCHER_TYPE}
      currencyInitiallyCollapsed
      itemsLayout="table"
    />
  );
};

export default InternalDocumentsScreen;
