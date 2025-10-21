import React, { useCallback } from 'react';
import { Alert } from 'react-native';
// eslint-disable-next-line import/no-unresolved
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { FACTURA_X_VOUCHER_TYPE } from '@/constants/invoiceOptions';
import {
  InternalDocumentForm,
  InternalDocumentValues,
} from '@/components/internal-documents/InternalDocumentForm';

const InternalDocumentsScreen: React.FC = () => {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (values: InternalDocumentValues) => {
      try {
        await Clipboard.setStringAsync(JSON.stringify(values, null, 2));
      } catch (error) {
        console.error('Unable to copy internal document payload:', error);
      }
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
    <InternalDocumentForm
      onSubmit={handleSubmit}
      submitLabel="Generar comprobante interno"
      allowedVoucherTypes={[FACTURA_X_VOUCHER_TYPE]}
      onCancel={() => router.back()}
    />
  );
};

export default InternalDocumentsScreen;
