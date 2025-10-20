import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AfipInvoiceForm } from '@/components/invoices/AfipInvoiceForm';
import { InvoicesContext, CreateAfipInvoicePayload } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '@/components/ThemedText';

const normaliseId = (value: string | string[] | undefined): number | null => {
  if (!value) {
    return null;
  }
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function EditAfipInvoiceScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const invoiceId = normaliseId(params.id);
  const router = useRouter();

  const { invoices, refreshInvoice, submitAfipInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceNotFound, setInvoiceNotFound] = useState(false);

  const background = useThemeColor({}, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  const canSubmit =
    permissions.includes('submitAfipInvoice') ||
    permissions.includes('updateInvoice') ||
    permissions.includes('createInvoice');

  const existingInvoice = useMemo(
    () => (invoiceId === null ? null : invoices.find(invoice => invoice.id === invoiceId) ?? null),
    [invoiceId, invoices]
  );

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (invoiceId === null) {
      Alert.alert('Factura no encontrada', 'No pudimos identificar la factura seleccionada.', [
        {
          text: 'Aceptar',
          onPress: () => router.back(),
        },
      ]);
      return;
    }
    if (!canSubmit) {
      Alert.alert('Permiso insuficiente', 'No tienes permiso para emitir facturas AFIP.', [
        {
          text: 'Aceptar',
          onPress: () => router.back(),
        },
      ]);
      return;
    }
    if (fetchedRef.current) {
      return;
    }
    fetchedRef.current = true;

    let mounted = true;
    setLoading(true);
    refreshInvoice(invoiceId)
      .then(result => {
        if (!mounted) {
          return;
        }
        setInvoiceNotFound(!result && !existingInvoice);
      })
      .catch(error => {
        if (!mounted) {
          return;
        }
        console.error('Error loading invoice for AFIP submission:', error);
        Alert.alert('Error', 'No se pudo cargar la información de la factura.');
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [canSubmit, existingInvoice, invoiceId, refreshInvoice, router]);

  useEffect(() => {
    if (existingInvoice) {
      setInvoiceNotFound(false);
    }
  }, [existingInvoice]);

  const handleSubmit = useCallback(
    async (payload: CreateAfipInvoicePayload) => {
      if (invoiceId === null) {
        Alert.alert('Factura no disponible', 'No se pudo identificar la factura a enviar a AFIP.');
        return;
      }
      setSubmitting(true);
      try {
        const updated = await submitAfipInvoice(invoiceId, payload);
        if (updated) {
          Alert.alert('Factura enviada', 'Se envió la factura a AFIP correctamente.', [
            {
              text: 'Ver detalle',
              onPress: () =>
                router.replace({ pathname: '/invoices/[id]', params: { id: updated.id.toString() } }),
            },
            {
              text: 'Cerrar',
              style: 'cancel',
              onPress: () => router.back(),
            },
          ]);
        } else {
          Alert.alert(
            'Factura actualizada',
            'Se envió la solicitud de emisión a AFIP. Revisa el detalle para confirmar el CAE.'
          );
          router.back();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo enviar la factura a AFIP.';
        Alert.alert('Error AFIP', message);
      } finally {
        setSubmitting(false);
      }
    },
    [invoiceId, router, submitAfipInvoice]
  );

  if (invoiceId === null || !canSubmit) {
    return null;
  }

  if (loading && !existingInvoice) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: background }}>
        <ActivityIndicator size="large" color={spinnerColor} />
      </View>
    );
  }

  if (invoiceNotFound && !existingInvoice) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: background, padding: 24 }}>
        <ThemedText style={{ fontSize: 16, textAlign: 'center', color: textColor }}>
          No encontramos la factura solicitada. Vuelve al listado y selecciona otra factura para reenviarla a AFIP.
        </ThemedText>
      </View>
    );
  }

  return (
    <AfipInvoiceForm
      initialInvoice={existingInvoice ?? undefined}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Enviar a AFIP"
      onCancel={() => router.back()}
    />
  );
}
