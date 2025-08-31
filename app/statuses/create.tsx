// app/statuses/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusesContext } from '@/contexts/StatusesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CreateStatus() {
  const router = useRouter();
  const { addStatus } = useContext(StatusesContext);
  const { permissions } = useContext(PermissionsContext);

  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [orderIndex, setOrderIndex] = useState('0');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addStatus')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar estados.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!label || !value || !backgroundColor || orderIndex === '') {
      Alert.alert('Error', 'Completa todos los campos requeridos.');
      return;
    }
    setLoading(true);
    const newStatus = await addStatus({
      label,
      value,
      background_color: backgroundColor,
      order_index: parseInt(orderIndex, 10),
    });
    setLoading(false);
    if (newStatus) {
      Alert.alert('Éxito', 'Estado creado correctamente.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el estado.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Etiqueta</Text>
      <TextInput
        style={styles.input}
        placeholder="Etiqueta del estado"
        value={label}
        onChangeText={setLabel}
      />

      <Text style={styles.label}>Valor</Text>
      <TextInput
        style={styles.input}
        placeholder="Valor del estado"
        value={value}
        onChangeText={setValue}
      />

      <Text style={styles.label}>Color de Fondo (HEX)</Text>
      <TextInput
        style={styles.input}
        placeholder="#ffffff"
        value={backgroundColor}
        onChangeText={setBackgroundColor}
      />

      <Text style={styles.label}>Orden (Índice)</Text>
      <TextInput
        style={styles.input}
        placeholder="Orden de visualización"
        value={orderIndex}
        keyboardType="numeric"
        onChangeText={setOrderIndex}
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear Estado</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#28a745', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
