import React, { useContext, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { InvoicesContext, CaeExpiryAlert } from '@/contexts/InvoicesContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const alertKey = (alert: CaeExpiryAlert) => `${alert.invoiceId}-${alert.caeDueDate}`;

export const CaeExpiryNotifications: React.FC = () => {
  const { caeAlerts, dismissCaeAlert, requestInvoiceReprint } =
    useContext(InvoicesContext);
  const [pendingReprint, setPendingReprint] = useState<number | null>(null);

  const background = useThemeColor({ light: '#1f2937', dark: '#1f2937' }, 'background');
  const textColor = useThemeColor({ light: '#f9fafb', dark: '#f9fafb' }, 'text');
  const highlight = useThemeColor({ light: '#fbbf24', dark: '#fbbf24' }, 'tint');
  const borderColor = useThemeColor({ light: 'rgba(255,255,255,0.2)', dark: 'rgba(255,255,255,0.2)' }, 'background');

  const notifications = useMemo(() => {
    if (caeAlerts.length === 0) {
      return [] as CaeExpiryAlert[];
    }
    return [...caeAlerts].sort((a, b) => a.caeDueDate.localeCompare(b.caeDueDate));
  }, [caeAlerts]);

  const handleReprint = async (alert: CaeExpiryAlert) => {
    setPendingReprint(alert.invoiceId);
    const success = await requestInvoiceReprint(alert.invoiceId);
    setPendingReprint(null);
    if (!success) {
      Alert.alert(
        'No se pudo reimprimir',
        'Revisa tu conexión e inténtalo nuevamente.'
      );
      return;
    }
    dismissCaeAlert(alert.invoiceId);
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.container}>
        {notifications.map(alert => (
          <View
            key={alertKey(alert)}
            style={[
              styles.notification,
              {
                backgroundColor: background,
                borderColor,
              },
            ]}
          >
            <ThemedText style={[styles.title, { color: highlight }]}>
              CAE próximo a vencer
            </ThemedText>
            <ThemedText style={[styles.message, { color: textColor }]}>
              La factura {alert.invoiceNumber} vence en {alert.daysUntilExpiration} día
              {alert.daysUntilExpiration === 1 ? '' : 's'} (CAE {alert.cae ?? 'sin asignar'}).
            </ThemedText>
            <ThemedText style={[styles.footer, { color: textColor }]}>
              Vencimiento: {formatDate(alert.caeDueDate)}
            </ThemedText>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: highlight }]}
                onPress={() => void handleReprint(alert)}
                disabled={pendingReprint === alert.invoiceId}
              >
                {pendingReprint === alert.invoiceId ? (
                  <ActivityIndicator color={highlight} />
                ) : (
                  <ThemedText style={[styles.actionText, { color: highlight }]}>Reimprimir</ThemedText>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: 'transparent' }]}
                onPress={() => dismissCaeAlert(alert.invoiceId)}
              >
                <ThemedText style={[styles.actionText, { color: textColor }]}>Descartar</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  container: {
    width: '100%',
    maxWidth: 460,
    gap: 12,
  },
  notification: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    marginBottom: 6,
  },
  footer: {
    fontSize: 13,
    opacity: 0.85,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CaeExpiryNotifications;
