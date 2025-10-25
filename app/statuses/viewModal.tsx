import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, StyleSheet, Button } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { StatusesContext } from '@/contexts/StatusesContext';

export default function ViewStatusModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const statusId = Number(id);
  const router = useRouter();
  const { statuses } = useContext(StatusesContext);

  const status = statuses.find(s => s.id === statusId);

  const screenBackground = useThemeColor({}, 'background');

  if (!status) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}>
        <ThemedText>Estado no encontrado</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
      <View style={[styles.colorBox, { backgroundColor: status.background_color }]} />

      <ThemedText style={styles.label}>Etiqueta</ThemedText>
      <ThemedText style={styles.value}>{status.label}</ThemedText>

      <ThemedText style={styles.label}>ID</ThemedText>
      <ThemedText style={styles.value}>{status.id}</ThemedText>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/statuses/${status.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  colorBox: { width: '100%', height: 40, borderRadius: 4 },
  editButton: { marginTop: 16 },
});
