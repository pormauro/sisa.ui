// /app/clients/viewModal.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, StyleSheet, Button } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';

export default function ViewClientModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const router = useRouter();
  const { clients } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);

  const client = clients.find(c => c.id === clientId);
  const tariff = tariffs.find(t => t.id === client?.tariff_id);

  const background = useThemeColor({}, 'background');

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
        <View style={styles.sectionRow}>
          <ThemedText style={styles.sectionLabel}>Total no facturado</ThemedText>
          <ThemedText style={styles.sectionValue}>
            {formatCurrency(client.unbilled_total)}
          </ThemedText>
        </View>
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

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/clients/${client.id}`)} />
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
  },
  sectionLabel: { fontSize: 15 },
  sectionValue: { fontSize: 15, fontWeight: '600' },
  editButton: { marginTop: 16 },
});
