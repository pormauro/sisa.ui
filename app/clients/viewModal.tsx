// /app/clients/viewModal.tsx
import { useLocalSearchParams } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext } from '@/contexts/TariffsContext';

export default function ViewClientModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const { clients } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);

  const client = clients.find(c => c.id === clientId);
  const tariff = tariffs.find(t => t.id === client?.tariff_id);

  if (!client) {
    return (
      <View style={styles.container}>
        <Text>Cliente no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <CircleImagePicker fileId={client.brand_file_id} size={200} editable={false} />

      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{client.id}</Text>

      <Text style={styles.label}>Fecha de creación</Text>
      <Text style={styles.value}>{client.created_at}</Text>

      <Text style={styles.label}>Fecha de modificación</Text>
      <Text style={styles.value}>{client.updated_at}</Text>

      <Text style={styles.label}>Nombre del Negocio</Text>
      <Text style={styles.value}>{client.business_name}</Text>

      <Text style={styles.label}>Tax ID</Text>
      <Text style={styles.value}>{client.tax_id}</Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{client.email}</Text>

      <Text style={styles.label}>Teléfono</Text>
      <Text style={styles.value}>{client.phone}</Text>

      <Text style={styles.label}>Dirección</Text>
      <Text style={styles.value}>{client.address}</Text>

      <Text style={styles.label}>Tarifa</Text>
      <Text style={styles.value}>{tariff ? `${tariff.name} - ${tariff.amount}` : 'Sin Tarifa'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
});
