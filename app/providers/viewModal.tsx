import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ProvidersContext } from '@/contexts/ProvidersContext';

export default function ViewProviderModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = Number(id);
  const router = useRouter();
  const { providers } = useContext(ProvidersContext);

  const provider = providers.find(p => p.id === providerId);

  if (!provider) {
    return (
      <View style={styles.container}>
        <Text>Proveedor no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <CircleImagePicker fileId={provider.brand_file_id} size={200} editable={false} />

      <Text style={styles.label}>Nombre</Text>
      <Text style={styles.value}>{provider.business_name}</Text>

      {provider.tax_id ? (
        <>
          <Text style={styles.label}>Tax ID</Text>
          <Text style={styles.value}>{provider.tax_id}</Text>
        </>
      ) : null}

      {provider.email ? (
        <>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{provider.email}</Text>
        </>
      ) : null}

      {provider.phone ? (
        <>
          <Text style={styles.label}>Teléfono</Text>
          <Text style={styles.value}>{provider.phone}</Text>
        </>
      ) : null}

      {provider.address ? (
        <>
          <Text style={styles.label}>Dirección</Text>
          <Text style={styles.value}>{provider.address}</Text>
        </>
      ) : null}

      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{provider.id}</Text>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/providers/${provider.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  editButton: { marginTop: 16 },
});
