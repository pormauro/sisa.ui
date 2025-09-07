import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, StyleSheet, Button } from 'react-native';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ViewProviderModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = Number(id);
  const router = useRouter();
  const { providers } = useContext(ProvidersContext);

  const provider = providers.find(p => p.id === providerId);

  const background = useThemeColor({}, 'background');

  if (!provider) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Proveedor no encontrado</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <CircleImagePicker fileId={provider.brand_file_id} size={200} editable={false} />

      <ThemedText style={styles.label}>Nombre</ThemedText>
      <ThemedText style={styles.value}>{provider.business_name}</ThemedText>

      {provider.tax_id ? (
        <>
          <ThemedText style={styles.label}>Tax ID</ThemedText>
          <ThemedText style={styles.value}>{provider.tax_id}</ThemedText>
        </>
      ) : null}

      {provider.email ? (
        <>
          <ThemedText style={styles.label}>Email</ThemedText>
          <ThemedText style={styles.value}>{provider.email}</ThemedText>
        </>
      ) : null}

      {provider.phone ? (
        <>
          <ThemedText style={styles.label}>Teléfono</ThemedText>
          <ThemedText style={styles.value}>{provider.phone}</ThemedText>
        </>
      ) : null}

      {provider.address ? (
        <>
          <ThemedText style={styles.label}>Dirección</ThemedText>
          <ThemedText style={styles.value}>{provider.address}</ThemedText>
        </>
      ) : null}

      <ThemedText style={styles.label}>ID</ThemedText>
      <ThemedText style={styles.value}>{provider.id}</ThemedText>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/providers/${provider.id}`)} />
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
