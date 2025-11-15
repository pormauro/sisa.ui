// /app/clients/viewModal.tsx
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { InvoicesContext } from '@/contexts/InvoicesContext';
import { useClientFinalizedJobTotals } from '@/hooks/useClientFinalizedJobTotals';
import { useClientInvoiceSummary } from '@/hooks/useClientInvoiceSummary';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function ViewClientModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const { clients } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const { loadInvoices } = useContext(InvoicesContext);
  const { getTotalForClient } = useClientFinalizedJobTotals();
  const { getSummary: getInvoiceSummary } = useClientInvoiceSummary();
  const { permissions } = useContext(PermissionsContext);

  const client = clients.find(c => c.id === clientId);
  const tariff = tariffs.find(t => t.id === client?.tariff_id);
  const finalizedJobsTotal = getTotalForClient(client?.id);
  const canViewJobs = permissions.includes('listJobs');
  const canViewInvoices = permissions.includes('listInvoices');
  const canViewReceipts = permissions.includes('listReceipts');
  const canViewAccounting = canViewInvoices || canViewReceipts;
  const canViewClientCalendar = permissions.includes('listAppointments') || canViewJobs;

  useEffect(() => {
    const title = client?.business_name ?? 'Cliente';
    const options: Partial<NativeStackNavigationOptions> = { title };
    navigation.setOptions(options);
  }, [client?.business_name, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!canViewInvoices) {
        return;
      }
      void loadInvoices();
    }, [canViewInvoices, loadInvoices])
  );

  const background = useThemeColor({}, 'background');
  const linkColor = useThemeColor({}, 'tint');
  const actionBackground = useThemeColor({ light: '#EEF2FF', dark: '#1F2937' }, 'background');
  const actionText = useThemeColor({ light: '#1F2937', dark: '#F3F4F6' }, 'text');
  const actionBorder = useThemeColor({ light: '#CBD5F5', dark: '#374151' }, 'background');

  if (!client) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Cliente no encontrado</ThemedText>
      </View>
    );
  }

  const invoiceSummary = canViewInvoices ? getInvoiceSummary(client.id) : undefined;
  const issuedInvoicesCount = invoiceSummary?.issuedCount ?? 0;
  const draftInvoicesCount = invoiceSummary?.draftCount ?? 0;
  const formattedIssuedInvoices = formatCurrency(invoiceSummary?.issuedTotal ?? 0);
  const formattedDraftInvoices = formatCurrency(invoiceSummary?.draftTotal ?? 0);
  const formattedUnpaidInvoicesTotal = formatCurrency(client.unpaid_invoices_total ?? 0);

  const handleOpenInvoices = () => {
    if (!canViewInvoices) {
      return;
    }
    router.push(`/clients/unpaidInvoices?id=${client.id}`);
  };

  const actionButtons = [
    {
      key: 'edit',
      label: 'Editar',
      icon: 'create-outline' as const,
      visible: true,
      onPress: () => router.push(`/clients/${client.id}`),
    },
    {
      key: 'calendar',
      label: 'Calendario',
      icon: 'calendar-outline' as const,
      visible: canViewClientCalendar,
      onPress: () => router.push(`/clients/calendar?id=${client.id}`),
    },
    {
      key: 'jobs',
      label: 'Trabajos',
      icon: 'checkmark-done-outline' as const,
      visible: canViewJobs,
      onPress: () => router.push(`/clients/finalizedJobs?id=${client.id}`),
    },
    {
      key: 'accounting',
      label: 'Contabilidad',
      icon: 'file-tray-stacked-outline' as const,
      visible: canViewAccounting,
      onPress: () => router.push(`/clients/accounting?id=${client.id}`),
    },
  ].filter(button => button.visible);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.screenTitle} numberOfLines={2}>
        {client.business_name && client.business_name.trim().length > 0
          ? client.business_name
          : 'Cliente sin nombre'}
      </ThemedText>
      <CircleImagePicker fileId={client.brand_file_id} size={200} editable={false} />

      {client.tax_id ? (
        <>
          <ThemedText style={styles.label}>CUIT</ThemedText>
          <ThemedText style={styles.value}>{client.tax_id}</ThemedText>
        </>
      ) : null}

      {client.email ? (
        <>
          <ThemedText style={styles.label}>Email</ThemedText>
          <ThemedText style={styles.value}>{client.email}</ThemedText>
        </>
      ) : null}

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Montos pendientes</ThemedText>
        <TouchableOpacity
          style={[styles.sectionRow, !canViewJobs && styles.sectionRowDisabled]}
          onPress={() => router.push(`/clients/finalizedJobs?id=${client.id}`)}
          accessibilityRole="button"
          activeOpacity={0.7}
          disabled={!canViewJobs}
        >
          <ThemedText
            style={[
              styles.sectionLabel,
              canViewJobs ? { color: linkColor, textDecorationLine: 'underline' } : null,
            ]}
          >
            Total no facturado
          </ThemedText>
          <ThemedText style={styles.sectionValue}>
            {formatCurrency(finalizedJobsTotal)}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionRow, !canViewInvoices && styles.sectionRowDisabled]}
          onPress={handleOpenInvoices}
          activeOpacity={0.7}
          disabled={!canViewInvoices}
          accessibilityRole="button"
        >
          <ThemedText
            style={[
              styles.sectionLabel,
              canViewInvoices ? { color: linkColor, textDecorationLine: 'underline' } : null,
            ]}
          >
            Facturas impagas
          </ThemedText>
          <ThemedText style={styles.sectionValue}>{formattedUnpaidInvoicesTotal}</ThemedText>
        </TouchableOpacity>
      </View>

      {canViewInvoices ? (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Facturación</ThemedText>
          <View style={styles.invoiceSummaryRow}>
            <TouchableOpacity
              style={[styles.invoiceSummaryCard, { borderColor: actionBorder }]}
              activeOpacity={0.8}
              onPress={handleOpenInvoices}
            >
              <ThemedText style={styles.invoiceSummaryLabel}>Emitidas</ThemedText>
              <ThemedText style={styles.invoiceSummaryValue}>{formattedIssuedInvoices}</ThemedText>
              <ThemedText style={[styles.invoiceSummaryMeta, { color: linkColor }]}>
                {issuedInvoicesCount} {issuedInvoicesCount === 1 ? 'comprobante' : 'comprobantes'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.invoiceSummaryCard, { borderColor: actionBorder }]}
              activeOpacity={0.8}
              onPress={handleOpenInvoices}
            >
              <ThemedText style={styles.invoiceSummaryLabel}>Borradores</ThemedText>
              <ThemedText style={styles.invoiceSummaryValue}>{formattedDraftInvoices}</ThemedText>
              <ThemedText style={[styles.invoiceSummaryMeta, { color: linkColor }]}>
                {draftInvoicesCount} {draftInvoicesCount === 1 ? 'borrador' : 'borradores'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {tariff ? (
        <>
          <ThemedText style={styles.label}>Tarifa</ThemedText>
          <ThemedText style={styles.value}>{`${tariff.name} - ${tariff.amount}`}</ThemedText>
        </>
      ) : client.tariff_id ? (
        <>
          <ThemedText style={styles.label}>Tarifa</ThemedText>
          <ThemedText style={styles.value}>{client.tariff_id}</ThemedText>
        </>
      ) : null}

      {actionButtons.length ? (
        <View style={styles.actionsContainer}>
          {actionButtons.map(button => (
            <View style={styles.actionItem} key={button.key}>
              <TouchableOpacity
                style={[styles.iconCircle, { backgroundColor: actionBackground, borderColor: actionBorder }]}
                onPress={button.onPress}
                activeOpacity={0.85}
              >
                <Ionicons name={button.icon} size={22} color={actionText} />
              </TouchableOpacity>
              <ThemedText style={[styles.actionLabel, { color: actionText }]}>{button.label}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  screenTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  sectionRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionRowDisabled: {
    opacity: 0.6,
  },
  sectionLabel: { fontSize: 15 },
  sectionValue: { fontSize: 15, fontWeight: '600' },
  invoiceSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginHorizontal: -4,
  },
  invoiceSummaryCard: {
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    margin: 4,
  },
  invoiceSummaryLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', opacity: 0.8 },
  invoiceSummaryValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  invoiceSummaryMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  actionsContainer: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  actionItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 16,
    minWidth: 80,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { marginTop: 6, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
