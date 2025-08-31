// app/statuses/[id].tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusesContext } from '@/contexts/StatusesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function EditStatus() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const statusId = Number(id);
  const { statuses, updateStatus, deleteStatus } = useContext(StatusesContext);
  const { permissions } = useContext(PermissionsContext);

  const statusItem = statuses.find(s => s.id === statusId);

  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [orderIndex, setOrderIndex] = useState('0');
  const [loading, setLoading] = useState(false);

  const canEdit = permissions.includes('updateStatus');
  const canDelete = permissions.includes('deleteStatus');

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este estado.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (statusItem) {
      setLabel(statusItem.label);
      setValue(statusItem.value);
      setBackgroundColor(statusItem.background_color);
      setOrderIndex(statusItem.order_index.toString());
    } else {
      Alert.alert('Error', 'Estado no encontrado.');
      router.back();
    }
  }, [statusItem]);

  const handleUpdate = () => {
    if (!label || !value || !backgroundColor || orderIndex === '') {
      Alert.alert('Error', 'Completa todos los campos requeridos.');
      return;
    }
    Alert.alert('Actualizar Estado', '¿Deseas actualizar este estado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updateStatus(statusId, {
            label,
            value,
            background_color: backgroundColor,
            order_index: parseInt(orderIndex, 10),
          });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Estado actualizado correctamente.');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar el estado.');
          }
        }
      }
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Eliminar Estado', '¿Deseas eliminar este estado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteStatus(statusId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Estado eliminado correctamente.');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar el estado.');
          }
        }
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Etiqueta</Text>
      <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Etiqueta" />

      <Text style={styles.label}>Valor</Text>
      <TextInput style={styles.input} value={value} onChangeText={setValue} placeholder="Valor" />

      <Text style={styles.label}>Color de Fondo (HEX)</Text>
      <TextInput style={styles.input} value={backgroundColor} onChangeText={setBackgroundColor} placeholder="#ffffff" />

      <Text style={styles.label}>Orden (Índice)</Text>
      <TextInput style={styles.input} value={orderIndex} keyboardType="numeric" onChangeText={setOrderIndex} placeholder="Orden" />

      {canEdit && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUpdate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Actualizar Estado</Text>}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Eliminar Estado</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#007BFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
