import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { AfipInvoiceForm } from '@/components/invoices/AfipInvoiceForm';
import { InvoicesContext, CreateAfipInvoicePayload } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CreateAfipInvoiceScreen() {
  const router = useRouter();
  const { createInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);

  const [submitting, setSubmitting] = useState(false);

  const canCreate =
    permissions.includes('createInvoice') ||
    permissions.includes('submitAfipInvoice') ||
    permissions.includes('updateInvoice');

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Permiso insuficiente', 'No tienes permiso para emitir facturas AFIP.', [
        {
          text: 'Aceptar',
          onPress: () => router.back(),
        },
      ]);
    }
  }, [canCreate, router]);

  const handleSubmit = useCallback(
    async (payload: CreateAfipInvoicePayload) => {
      if (!canCreate) {
        Alert.alert('Permiso insuficiente', 'No puedes emitir facturas AFIP.');
        return;
      }

      setSubmitting(true);
      try {
        const invoice = await createInvoice(payload);
        if (invoice) {
          Alert.alert('Factura enviada', 'La factura se registró correctamente.', [
            {
              text: 'Ver detalle',
              onPress: () =>
                router.replace({ pathname: '/invoices/[id]', params: { id: invoice.id.toString() } }),
            },
            {
              text: 'Cerrar',
              style: 'cancel',
              onPress: () => router.back(),
            },
          ]);
        } else {
          Alert.alert(
            'Factura registrada',
            'La operación finalizó correctamente. Podrás revisar el detalle en el listado de facturas.'
          );
          router.back();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo crear la factura AFIP.';
        Alert.alert('Error AFIP', message);
      } finally {
        setSubmitting(false);
      }
    },
    [canCreate, createInvoice, router]
  );

  return (
    <AfipInvoiceForm
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Emitir factura AFIP"
      onManagePointsOfSale={() => router.push('/afip/points-of-sale')}
      onCancel={() => router.back()}
    />
  );
}
