import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ViewTariffModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tariffId = Number(id);
  const router = useRouter();
  const { tariffs } = useContext(TariffsContext);

  const tariff = tariffs.find(t => t.id === tariffId);

  const background = useThemeColor({}, 'background');

  if (!tariff) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Tarifa no encontrada</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}> 
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <ThemedText style={styles.value}>{tariff.name}</ThemedText>

      <ThemedText style={styles.label}>Monto</ThemedText>
      <ThemedText style={styles.value}>{tariff.amount}</ThemedText>

      <ThemedText style={styles.label}>Última actualización</ThemedText>
      <ThemedText style={styles.value}>{tariff.last_update}</ThemedText>

      <ThemedText style={styles.label}>ID</ThemedText>
      <ThemedText style={styles.value}>{tariff.id}</ThemedText>

      <ThemedButton
        title="Editar"
        onPress={() => router.push(`/tariffs/${tariff.id}`)}
        style={styles.editButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  editButton: { marginTop: 16 },
});
