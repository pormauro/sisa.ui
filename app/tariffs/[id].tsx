// app/tariffs/[id].tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TariffsContext } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function EditTariff() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tariffId = Number(id);
  const { tariffs, updateTariff, deleteTariff } = useContext(TariffsContext);
  const { permissions } = useContext(PermissionsContext);

  const tariff = tariffs.find(t => t.id === tariffId);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const canEdit = permissions.includes('updateTariff');
  const canDelete = permissions.includes('deleteTariff');

  useEffect(() => {
    if (!tariff) {
      Alert.alert('Error', 'Tarifa no encontrada.');
      router.back();
      return;
    }
    setName(tariff.name);
    setAmount(String(tariff.amount));
  }, [tariff]);

  const handleSubmit = async () => {
    if (!canEdit) {
      Alert.alert('Acceso denegado', 'No tienes permiso para actualizar tarifas.');
      return;
    }
    if (!name || !amount) {
      Alert.alert('Error', 'Completa todos los campos.');
      return;
    }
    setLoading(true);
    const success = await updateTariff(tariffId, { name, amount: parseFloat(amount) });
    setLoading(false);
    if (success) {
      Alert.alert('Éxito', 'Tarifa actualizada.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo actualizar la tarifa.');
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    Alert.alert('Eliminar', '¿Deseas eliminar esta tarifa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteTariff(tariffId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Tarifa eliminada.');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar la tarifa.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        editable={canEdit}
      />

      <Text style={styles.label}>Monto</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        editable={canEdit}
      />

      {canEdit && (
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Guardar Cambios</Text>}
        </TouchableOpacity>
      )}

      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Eliminar</Text>}
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
