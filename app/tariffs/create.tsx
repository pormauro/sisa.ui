// app/tariffs/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { TariffsContext } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CreateTariff() {
  const router = useRouter();
  const { addTariff } = useContext(TariffsContext);
  const { permissions } = useContext(PermissionsContext);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addTariff')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar tarifas.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!name || !amount) {
      Alert.alert('Error', 'Completa todos los campos.');
      return;
    }
    setLoading(true);
    const newTariff = await addTariff({ name, amount: parseFloat(amount) });
    setLoading(false);
    if (newTariff) {
      Alert.alert('Éxito', 'Tarifa creada.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear la tarifa.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre de la tarifa"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Monto</Text>
      <TextInput
        style={styles.input}
        placeholder="Monto"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear Tarifa</Text>}
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
