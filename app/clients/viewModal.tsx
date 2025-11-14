// /app/clients/viewModal.tsx
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useContext, useEffect } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { useClientFinalizedJobTotals } from '@/hooks/useClientFinalizedJobTotals';
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
  const { getTotalForClient } = useClientFinalizedJobTotals();
  const { permissions } = useContext(PermissionsContext);

  const client = clients.find(c => c.id === clientId);
  const tariff = tariffs.find(t => t.id === client?.tariff_id);
  const finalizedJobsTotal = getTotalForClient(client?.id);
  const canViewJobs = permissions.includes('listJobs');
  const canViewInvoices = permissions.includes('listInvoices');
  const canViewClientCalendar = permissions.includes('listAppointments') || canViewJobs;

  useEffect(() => {
    const title = client?.business_name ?? 'Cliente';
    const options: Partial<NativeStackNavigationOptions> = { title };
    navigation.setOptions(options);
  }, [client?.business_name, navigation]);

  const background = useThemeColor({}, 'background');
  const linkColor = useThemeColor({}, 'tint');
  const actionBackground = useThemeColor({ light: '#EEF2FF', dark: '#1F2937' }, 'background');
  const actionText = useThemeColor({ light: '#1F2937', dark: '#F3F4F6' }, 'text');

  if (!client) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}> 
        <ThemedText>Cliente no encontrado</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <CircleImagePicker fileId={client.brand_file_id} size={200} editable={false} />

      <ThemedText style={styles.label}>Nombre del Negocio</ThemedText>
      <ThemedText style={styles.value}>{client.business_name}</ThemedText>

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

      {client.phone ? (
        <>
          <ThemedText style={styles.label}>Teléfono</ThemedText>
          <ThemedText style={styles.value}>{client.phone}</ThemedText>
        </>
      ) : null}

      {client.address ? (
        <>
          <ThemedText style={styles.label}>Dirección</ThemedText>
          <ThemedText style={styles.value}>{client.address}</ThemedText>
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
          onPress={() =>
            router.push(`/clients/unpaidInvoices?id=${client.id}`)
          }
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
          <ThemedText style={styles.sectionValue}>
            {formatCurrency(client.unpaid_invoices_total)}
          </ThemedText>
        </TouchableOpacity>
      </View>

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

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: actionBackground }]}
          onPress={() => router.push(`/clients/${client.id}`)}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={22} color={actionText} />
          <ThemedText style={[styles.iconButtonLabel, { color: actionText }]}>Editar</ThemedText>
        </TouchableOpacity>
        {canViewClientCalendar ? (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: actionBackground }]}
            onPress={() => router.push(`/clients/calendar?id=${client.id}`)}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={22} color={actionText} />
            <ThemedText style={[styles.iconButtonLabel, { color: actionText }]}>Calendario</ThemedText>
          </TouchableOpacity>
        ) : null}
        {canViewJobs ? (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: actionBackground }]}
            onPress={() => router.push(`/clients/finalizedJobs?id=${client.id}`)}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-done-outline" size={22} color={actionText} />
            <ThemedText style={[styles.iconButtonLabel, { color: actionText }]}>Finalizados</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
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
  actionsContainer: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    minWidth: 100,
    marginBottom: 12,
  },
  iconButtonLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
});
