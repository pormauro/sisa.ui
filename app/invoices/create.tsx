import React, { useCallback } from 'react';
import { Alert } from 'react-native';
// eslint-disable-next-line import/no-unresolved
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import {
  InternalDocumentForm,
  InternalDocumentValues,
} from '@/components/internal-documents/InternalDocumentForm';

export default function CreateInvoiceScreen() {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (values: InternalDocumentValues) => {
      try {
        await Clipboard.setStringAsync(JSON.stringify(values, null, 2));
      } catch (error) {
        console.error('Unable to copy invoice payload:', error);
      }
      Alert.alert(
        'Comprobante preparado',
        'Los datos seleccionados se copiaron al portapapeles para registrarlos como comprobante interno.',
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
      submitLabel="Generar comprobante"
      onCancel={() => router.back()}
    />
  );
}
