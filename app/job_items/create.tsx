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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'open' | 'done' | 'cancelled'>('open');
  const [orderIndex, setOrderIndex] = useState('1');
  const [timeNote, setTimeNote] = useState('');

  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');

  const parsedJobId = Number(job_id);

  const handleSave = async () => {
    if (!permissions.includes('addJobItem')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar items.');
      return;
    }

    if (!title.trim() || Number.isNaN(parsedJobId)) {
      Alert.alert('Campos incompletos', 'Completá al menos el título del ítem.');
      return;
    }

    const ok = await addJobItem({
      job_id: parsedJobId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      order_index: Number(orderIndex || 0),
      time_note: timeNote.trim() || null,
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
        <ThemedText style={[styles.label, { color: textColor }]}>Título</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Título del item"
          placeholderTextColor="#888"
        />

        <ThemedText style={[styles.label, { color: textColor }]}>Descripción</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción del item"
          placeholderTextColor="#888"
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

        <ThemedText style={[styles.label, { color: textColor }]}>Orden</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
          value={orderIndex}
          keyboardType="numeric"
          onChangeText={setOrderIndex}
        />

        <ThemedText style={[styles.label, { color: textColor }]}>Nota de tiempo</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: textColor }]}
          value={timeNote}
          onChangeText={setTimeNote}
          placeholder="00:30:00"
          placeholderTextColor="#888"
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
});
