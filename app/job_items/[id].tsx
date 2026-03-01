import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
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
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');

  useEffect(() => {
    if (!item) {
      return;
    }
    setDescription(item.description);
    setQuantity(String(item.quantity));
    setUnitPrice(String(item.unit_price));
  }, [item]);

  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');

  const handleSave = async () => {
    if (!permissions.includes('updateJobItem')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para editar items.');
      return;
    }

    const ok = await updateJobItem(itemId, {
      description: description.trim(),
      quantity: Number(quantity || 0),
      unit_price: Number(unitPrice || 0),
    });

    if (!ok) {
      Alert.alert('Error', 'No se pudo actualizar el item.');
      return;
    }

    if (item?.job_id) {
      await loadJobItems(item.job_id);
    }

    router.back();
  };

  const handleDelete = async () => {
    if (!permissions.includes('deleteJobItem')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para eliminar items.');
      return;
    }

    const ok = await deleteJobItem(itemId);
    if (!ok) {
      Alert.alert('Error', 'No se pudo eliminar el item.');
      return;
    }

    if (item?.job_id) {
      await loadJobItems(item.job_id);
    }

    router.back();
  };

  if (!item) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={{ color: textColor }}>Item no encontrado.</ThemedText>
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

        <ThemedText style={[styles.label, { color: textColor }]}>Cantidad</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
          value={quantity}
          keyboardType="numeric"
          onChangeText={setQuantity}
        />

        <ThemedText style={[styles.label, { color: textColor }]}>Precio unitario</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
          value={unitPrice}
          keyboardType="numeric"
          onChangeText={setUnitPrice}
        />

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
  buttonText: { color: '#fff', fontWeight: '600' },
});
