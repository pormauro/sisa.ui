import React, { useContext, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PaymentTemplatesContext } from '@/contexts/PaymentTemplatesContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { MenuButton } from '@/components/MenuButton';
import { toMySQLDateTime } from '@/utils/date';
import { resolvePaymentTemplateIcon } from '@/utils/paymentTemplateIcons';

export default function ViewPaymentTemplateModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = Number(id);
  const router = useRouter();

  const { paymentTemplates } = useContext(PaymentTemplatesContext);
  const { categories } = useContext(CategoriesContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const template = paymentTemplates.find(item => item.id === templateId);

  const categoryName = template
    ? categories.find(category => category.id === template.default_category_id)?.name ?? 'Sin categoría'
    : '';
  const cashBoxName = template
    ? cashBoxes.find(cashBox => cashBox.id.toString() === template.default_paid_with_account)
        ?.name ?? template.default_paid_with_account ?? 'Sin cuenta'
    : '';

  const creditorName = useMemo(() => {
    if (!template) {
      return 'Sin acreedor';
    }
    if (template.default_creditor_type === 'client') {
      return (
        clients.find(client => client.id === template.default_creditor_client_id)?.business_name ??
        'Cliente sin nombre'
      );
    }
    if (template.default_creditor_type === 'provider') {
      return (
        providers.find(provider => provider.id === template.default_creditor_provider_id)
          ?.business_name ?? 'Proveedor sin nombre'
      );
    }
    return template.default_creditor_other ?? 'Sin acreedor';
  }, [clients, providers, template]);

  const updatedLabel = template
    ? template.updated_at
      ? toMySQLDateTime(new Date(template.updated_at))
      : template.created_at
      ? toMySQLDateTime(new Date(template.created_at))
      : ''
    : '';

  const amountLabel = template?.default_amount
    ? `$${Number(template.default_amount).toFixed(2)}`
    : 'Sin monto';

  const defaultPaymentDateLabel = template?.default_payment_date
    ? (() => {
        const parsed = new Date(template.default_payment_date.replace(' ', 'T'));
        if (Number.isNaN(parsed.getTime())) {
          return template.default_payment_date;
        }
        return toMySQLDateTime(parsed);
      })()
    : 'Sin fecha';

  if (!template) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background, alignItems: 'center', justifyContent: 'center' }]}>
        <ThemedText>Plantilla no encontrada.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.title}>{template.name}</ThemedText>
      <ThemedText style={styles.subtitle}>Última actualización: {updatedLabel || 'N/D'}</ThemedText>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Icono sugerido</ThemedText>
        <View style={styles.iconRow}>
          <View style={[styles.iconBadge, { backgroundColor: tintColor }]}>
            <Ionicons
              name={resolvePaymentTemplateIcon(template.icon_name)}
              size={20}
              color="#fff"
            />
          </View>
          <ThemedText style={styles.value}>{template.icon_name || 'Predeterminado'}</ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Descripción</ThemedText>
        <ThemedText style={styles.value}>{template.description || 'Sin descripción'}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Monto predeterminado</ThemedText>
        <ThemedText style={styles.value}>{amountLabel}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Categoría contable</ThemedText>
        <ThemedText style={styles.value}>{categoryName}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Cuenta</ThemedText>
        <ThemedText style={styles.value}>{cashBoxName || 'Sin cuenta'}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Fecha predeterminada</ThemedText>
        <ThemedText style={styles.value}>{defaultPaymentDateLabel}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Acreedor predeterminado</ThemedText>
        <ThemedText style={styles.value}>{creditorName}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Tipo de acreedor</ThemedText>
        <ThemedText style={styles.value}>
          {template.default_creditor_type === 'client'
            ? 'Cliente'
            : template.default_creditor_type === 'provider'
            ? 'Proveedor'
            : 'Otro'}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Cargar a cliente</ThemedText>
        <ThemedText style={styles.value}>
          {template.default_charge_client
            ? clients.find(client => client.id === template.default_charge_client_id)?.business_name ||
              'Cliente sin nombre'
            : 'No'}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Archivos adjuntos</ThemedText>
        <ThemedText style={styles.value}>
          {template.attached_files && template.attached_files.length > 0
            ? `${template.attached_files.length} archivo(s)`
            : 'Sin archivos'}
        </ThemedText>
      </View>

      {permissions.includes('updatePaymentTemplate') ? (
        <MenuButton
          title="Editar"
          icon="create-outline"
          onPress={() => router.replace(`/payment_templates/${template.id}`)}
          showChevron={false}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
  },
});

