// /app/clients/viewModal.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, StyleSheet, Button, TouchableOpacity } from 'react-native';
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
  const { clients } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const { getTotalForClient } = useClientFinalizedJobTotals();
  const { permissions } = useContext(PermissionsContext);

  const client = clients.find(c => c.id === clientId);
  const tariff = tariffs.find(t => t.id === client?.tariff_id);
  const finalizedJobsTotal = getTotalForClient(client?.id);
  const canViewJobs = permissions.includes('listJobs');

  const background = useThemeColor({}, 'background');
  const linkColor = useThemeColor({}, 'tint');

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
        <View style={styles.sectionRow}>
          <ThemedText style={styles.sectionLabel}>Facturas impagas</ThemedText>
          <ThemedText style={styles.sectionValue}>
            {formatCurrency(client.unpaid_invoices_total)}
          </ThemedText>
        </View>
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

      <ThemedText style={styles.label}>ID</ThemedText>
      <ThemedText style={styles.value}>{client.id}</ThemedText>

      {client.created_at ? (
        <>
          <ThemedText style={styles.label}>Fecha de creación</ThemedText>
          <ThemedText style={styles.value}>{client.created_at}</ThemedText>
        </>
      ) : null}

      {client.updated_at ? (
        <>
          <ThemedText style={styles.label}>Fecha de modificación</ThemedText>
          <ThemedText style={styles.value}>{client.updated_at}</ThemedText>
        </>
      ) : null}

      <View style={styles.actionsContainer}>
        <View style={styles.actionButton}>
          <Button title="Editar" onPress={() => router.push(`/clients/${client.id}`)} />
        </View>
        {canViewJobs ? (
          <View style={styles.actionButton}>
            <Button
              title="Trabajos finalizados"
              onPress={() => router.push(`/clients/finalizedJobs?id=${client.id}`)}
            />
          </View>
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
    marginTop: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
});
