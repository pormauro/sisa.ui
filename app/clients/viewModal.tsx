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

  const renderField = (label: string, value: string | null | undefined) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return (
      <>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <ThemedText style={styles.value}>{trimmed}</ThemedText>
      </>
    );
  };

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

      {renderField('Nombre del Negocio', client.business_name)}
      {renderField('CUIT', client.tax_id)}
      {renderField('Email', client.email)}
      {renderField('Teléfono', client.phone)}
      {renderField('Dirección', client.address)}
      {renderField('Tarifa', tariff ? `${tariff.name} - ${tariff.amount}` : null)}
      {renderField('ID', String(client.id))}
      {renderField('Fecha de creación', client.created_at)}
      {renderField('Fecha de modificación', client.updated_at)}

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
