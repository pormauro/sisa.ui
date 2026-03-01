import React, { useContext, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { JobItemsContext } from '@/contexts/JobItemsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CreateJobItemScreen() {
  const { job_id } = useLocalSearchParams<{ job_id: string }>();
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const { addJobItem, loadJobItems } = useContext(JobItemsContext);

  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');

  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');

  const parsedJobId = Number(job_id);

  const handleSave = async () => {
    if (!permissions.includes('addJobItem')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar items.');
      return;
    }

    if (!description.trim() || !unitPrice.trim() || Number.isNaN(parsedJobId)) {
      Alert.alert('Campos incompletos', 'Completá descripción y precio unitario.');
      return;
    }

    const ok = await addJobItem({
      job_id: parsedJobId,
      description: description.trim(),
      quantity: Number(quantity || 0),
      unit_price: Number(unitPrice || 0),
    });

    if (ok) {
      await loadJobItems(parsedJobId);
      router.back();
      return;
    }

    Alert.alert('Error', 'No se pudo crear el item.');
  };

  return (
    <ThemedView style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText style={[styles.label, { color: textColor }]}>Descripción</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción del item"
          placeholderTextColor="#888"
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

        <TouchableOpacity style={styles.button} onPress={() => void handleSave()}>
          <ThemedText style={styles.buttonText}>Guardar</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { padding: 20 },
  label: { marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 6, padding: 10 },
  button: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2C2546',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
