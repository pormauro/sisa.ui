import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { JobItemsContext } from '@/contexts/JobItemsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function EditJobItemScreen() {
  const { id, job_id } = useLocalSearchParams<{ id: string; job_id?: string }>();
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const { jobItems, loadJobItems, updateJobItem, deleteJobItem } = useContext(JobItemsContext);

  const itemId = Number(id);
  const jobId = Number(job_id);

  useEffect(() => {
    if (!Number.isNaN(jobId) && jobId > 0) {
      void loadJobItems(jobId);
    }
  }, [jobId, loadJobItems]);

  const item = useMemo(() => jobItems.find(i => i.id === itemId), [jobItems, itemId]);

  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'open' | 'done' | 'cancelled'>('open');
  const [orderIndex, setOrderIndex] = useState('0');

  useEffect(() => {
    if (!item) {
      return;
    }
    setDescription(item.description ?? '');
    setStatus(item.status);
    setOrderIndex(String(item.order_index));
  }, [item]);

  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');

  const resolveJobId = () => item?.job_id ?? (!Number.isNaN(jobId) && jobId > 0 ? jobId : null);

  const handleSave = async () => {
    if (!permissions.includes('updateJobItem')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para editar items.');
      return;
    }

    const targetJobId = resolveJobId();
    if (!targetJobId || !description.trim()) {
      Alert.alert('Campos incompletos', 'Completá la descripción del ítem.');
      return;
    }

    const ok = await updateJobItem(targetJobId, itemId, {
      description: description.trim() || null,
      status,
      order_index: Number(orderIndex || 0),
    });

    if (!ok) {
      Alert.alert('Error', 'No se pudo actualizar el item.');
      return;
    }

    await loadJobItems(targetJobId);
    router.push(`/job_items/index?job_id=${targetJobId}`);
  };

  const handleDelete = async () => {
    if (!permissions.includes('deleteJobItem')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para eliminar items.');
      return;
    }

    const targetJobId = resolveJobId();
    if (!targetJobId) {
      Alert.alert('Error', 'No se encontró el trabajo asociado al ítem.');
      return;
    }

    const ok = await deleteJobItem(itemId);
    if (!ok) {
      Alert.alert('Error', 'No se pudo eliminar el item.');
      return;
    }

    await loadJobItems(targetJobId);
    router.push(`/job_items/index?job_id=${targetJobId}`);
  };

  const handleOpenList = () => {
    const targetJobId = resolveJobId();
    if (!targetJobId) {
      router.back();
      return;
    }
    router.push(`/job_items/index?job_id=${targetJobId}`);
  };

  if (!item) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={{ color: textColor }}>Item no encontrado.</ThemedText>
        {!Number.isNaN(jobId) && jobId > 0 && (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenList}>
            <ThemedText style={styles.secondaryButtonText}>Ir a la lista de items</ThemedText>
          </TouchableOpacity>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText style={[styles.label, { color: textColor }]}>Descripción</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
          value={description}
          onChangeText={setDescription}
        />

        <ThemedText style={[styles.label, { color: textColor }]}>Estado</ThemedText>
        <ScrollView horizontal contentContainerStyle={styles.statusOptions} showsHorizontalScrollIndicator={false}>
          {(['open', 'done', 'cancelled'] as const).map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.statusChip, status === option && styles.statusChipActive]}
              onPress={() => setStatus(option)}
            >
              <ThemedText style={[styles.statusChipText, status === option && styles.statusChipTextActive]}>
                {option}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ThemedText style={[styles.label, { color: textColor }]}>Posición</ThemedText>
        <View style={styles.positionRow}>
          <TouchableOpacity
            style={styles.positionButton}
            onPress={() => setOrderIndex(String(Math.max(0, Number(orderIndex || 0) - 1)))}
          >
            <ThemedText style={styles.positionButtonText}>Mover arriba</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.positionButton}
            onPress={() => setOrderIndex(String(Number(orderIndex || 0) + 1))}
          >
            <ThemedText style={styles.positionButtonText}>Mover abajo</ThemedText>
          </TouchableOpacity>
        </View>

        {permissions.includes('updateJobItem') && (
          <TouchableOpacity style={styles.button} onPress={() => void handleSave()}>
            <ThemedText style={styles.buttonText}>Guardar</ThemedText>
          </TouchableOpacity>
        )}

        {permissions.includes('deleteJobItem') && (
          <TouchableOpacity style={styles.deleteButton} onPress={() => void handleDelete()}>
            <ThemedText style={styles.buttonText}>Eliminar</ThemedText>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenList}>
          <ThemedText style={styles.secondaryButtonText}>Ir a la lista de items</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1, padding: 20 },
  label: { marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  button: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2C2546',
    alignItems: 'center',
  },
  deleteButton: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#dc3545',
    alignItems: 'center',
  },
  secondaryButton: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2546',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#2C2546', fontWeight: '600' },
  buttonText: { color: '#fff', fontWeight: '600' },
  statusOptions: { gap: 8, marginBottom: 8 },
  statusChip: {
    borderWidth: 1,
    borderColor: '#2C2546',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statusChipActive: { backgroundColor: '#2C2546' },
  statusChipText: { color: '#2C2546', fontWeight: '600' },
  statusChipTextActive: { color: '#fff' },
  positionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  positionButton: {
    borderWidth: 1,
    borderColor: '#2C2546',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  positionButtonText: { color: '#2C2546', fontWeight: '600' },
});
