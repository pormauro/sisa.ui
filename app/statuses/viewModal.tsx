import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import { StatusesContext } from '@/contexts/StatusesContext';

export default function ViewStatusModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const statusId = Number(id);
  const router = useRouter();
  const { statuses } = useContext(StatusesContext);

  const status = statuses.find(s => s.id === statusId);

  if (!status) {
    return (
      <View style={styles.container}>
        <Text>Estado no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.colorBox, { backgroundColor: status.background_color }]} />

      <Text style={styles.label}>Etiqueta</Text>
      <Text style={styles.value}>{status.label}</Text>

      <Text style={styles.label}>Valor</Text>
      <Text style={styles.value}>{status.value}</Text>

      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{status.id}</Text>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/statuses/${status.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  colorBox: { width: '100%', height: 40, borderRadius: 4 },
  editButton: { marginTop: 16 },
});
