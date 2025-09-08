// /app/clients/viewModal.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, StyleSheet, Button } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

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

  if (client.pendingDelete) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Este cliente está pendiente de eliminación.</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <CircleImagePicker fileId={client.brand_file_id} size={200} editable={false} />

      <ThemedText style={styles.label}>Nombre del Negocio</ThemedText>
      <ThemedText style={styles.value}>{client.business_name}</ThemedText>

      <ThemedText style={styles.label}>Tax ID</ThemedText>
      <ThemedText style={styles.value}>{client.tax_id}</ThemedText>

      <ThemedText style={styles.label}>Email</ThemedText>
      <ThemedText style={styles.value}>{client.email}</ThemedText>

      <ThemedText style={styles.label}>Teléfono</ThemedText>
      <ThemedText style={styles.value}>{client.phone}</ThemedText>

      <ThemedText style={styles.label}>Dirección</ThemedText>
      <ThemedText style={styles.value}>{client.address}</ThemedText>

      <ThemedText style={styles.label}>Tarifa</ThemedText>
      <ThemedText style={styles.value}>{tariff ? `${tariff.name} - ${tariff.amount}` : 'Sin Tarifa'}</ThemedText>

      <ThemedText style={styles.label}>ID</ThemedText>
      <ThemedText style={styles.value}>{client.id}</ThemedText>

      <ThemedText style={styles.label}>Fecha de creación</ThemedText>
      <ThemedText style={styles.value}>{client.created_at}</ThemedText>

      <ThemedText style={styles.label}>Fecha de modificación</ThemedText>
      <ThemedText style={styles.value}>{client.updated_at}</ThemedText>

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
  editButton: { marginTop: 16 },
});
