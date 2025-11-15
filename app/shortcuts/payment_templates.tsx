import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  PaymentTemplate,
  PaymentTemplatesContext,
} from '@/contexts/PaymentTemplatesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { MenuButton } from '@/components/MenuButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { resolvePaymentTemplateIcon } from '@/utils/paymentTemplateIcons';

const formatAmount = (amount?: number | null): string => {
  if (typeof amount === 'number') {
    return `$${amount.toFixed(2)}`;
  }
  return 'Monto sin definir';
};

const getRecipientLabel = (template: PaymentTemplate): string => {
  switch (template.default_creditor_type) {
    case 'client':
      return template.default_creditor_client_id ? 'Cliente predeterminado' : 'Cliente a elegir';
    case 'provider':
      return template.default_creditor_provider_id ? 'Proveedor predeterminado' : 'Proveedor a elegir';
    case 'other':
    default:
      return template.default_creditor_other ? 'Destinatario personalizado' : 'Destinatario manual';
  }
};

const ShortcutPaymentTemplatesScreen = () => {
  const router = useRouter();
  const { paymentTemplates, loadPaymentTemplates } = useContext(PaymentTemplatesContext);
  const { permissions } = useContext(PermissionsContext);

  const canListTemplates = permissions.includes('listPaymentTemplates');
  const canUseShortcut = permissions.includes('usePaymentTemplateShortcuts');
  const { refreshing, handleRefresh } = usePullToRefresh(
    loadPaymentTemplates,
    canListTemplates && canUseShortcut,
  );

  useEffect(() => {
    if (canListTemplates && canUseShortcut) {
      return;
    }

    Alert.alert(
      'Acceso denegado',
      'No tenés permisos para crear pagos desde plantillas.',
      [
        {
          text: 'Aceptar',
          onPress: () => {
            router.replace('/Home');
          },
        },
      ],
      { cancelable: false },
    );
  }, [canListTemplates, canUseShortcut, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canListTemplates || !canUseShortcut) {
        return;
      }
      void loadPaymentTemplates();
    }, [canListTemplates, canUseShortcut, loadPaymentTemplates]),
  );

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');

  const handleSelectTemplate = useCallback(
    (template: PaymentTemplate) => {
      const params: Record<string, string> = {
        fromTemplate: '1',
        templateId: String(template.id),
      };

      const normalizedDescription = template.description?.trim();
      if (normalizedDescription) {
        params.description = normalizedDescription;
      }

      if (template.default_paid_with_account !== undefined && template.default_paid_with_account !== null) {
        params.paidWithAccount = String(template.default_paid_with_account);
      }
      if (template.default_creditor_type) {
        params.creditorType = template.default_creditor_type;
      }
      if (
        template.default_creditor_client_id !== undefined &&
        template.default_creditor_client_id !== null
      ) {
        params.creditorClientId = String(template.default_creditor_client_id);
      }
      if (
        template.default_creditor_provider_id !== undefined &&
        template.default_creditor_provider_id !== null
      ) {
        params.creditorProviderId = String(template.default_creditor_provider_id);
      }
      if (template.default_creditor_other) {
        params.creditorOther = template.default_creditor_other;
      }
      if (template.default_category_id !== undefined && template.default_category_id !== null) {
        params.categoryId = String(template.default_category_id);
      }
      if (typeof template.default_amount === 'number') {
        params.amount = template.default_amount.toString();
      }
      if (typeof template.default_charge_client === 'boolean') {
        params.chargeClient = template.default_charge_client ? '1' : '0';
        if (
          template.default_charge_client &&
          template.default_charge_client_id !== undefined &&
          template.default_charge_client_id !== null
        ) {
          params.chargeClientId = String(template.default_charge_client_id);
        }
      }

      router.push({ pathname: '/payments/create', params });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: PaymentTemplate }) => (
      <MenuButton
        title={item.name}
        icon={resolvePaymentTemplateIcon(item.icon_name)}
        subtitle={`${formatAmount(item.default_amount)} · ${getRecipientLabel(item)}`}
        onPress={() => handleSelectTemplate(item)}
      />
    ),
    [handleSelectTemplate],
  );

  const keyExtractor = useCallback((item: PaymentTemplate) => String(item.id), []);

  const listEmptyComponent = useMemo(
    () => (
      <View style={[styles.emptyStateContainer, { borderColor }]}> 
        <ThemedText style={styles.emptyStateText}>
          No hay planillas de pago disponibles. Creá una desde el módulo de plantillas de pago.
        </ThemedText>
      </View>
    ),
    [borderColor],
  );

  const hasItems = paymentTemplates.length > 0;

  return (
    <ThemedView style={[styles.container, { backgroundColor: backgroundColor }]}> 
      <ThemedText style={styles.title}>Planillas de pagos</ThemedText>
      <ThemedText style={styles.description}>
        Elegí una planilla para precargar el formulario de pagos con sus valores predeterminados.
      </ThemedText>
      <FlatList
        data={paymentTemplates}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={hasItems ? styles.listContent : styles.emptyListContent}
        ListEmptyComponent={listEmptyComponent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </ThemedView>
  );
};

export default ShortcutPaymentTemplatesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyStateContainer: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
