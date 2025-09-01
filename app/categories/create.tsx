// app/categories/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CreateCategory() {
  const router = useRouter();
  const { addCategory } = useContext(CategoriesContext);
  const { permissions } = useContext(PermissionsContext);

  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addCategory')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar categorías.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!name) {
      Alert.alert('Error', 'Ingresa un nombre.');
      return;
    }
    setLoading(true);
    const newCategory = await addCategory({ name, type, parent_id: null });
    setLoading(false);
    if (newCategory) {
      Alert.alert('Éxito', 'Categoría creada.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear la categoría.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre" />

      <Text style={styles.label}>Tipo (income/expense)</Text>
      <TextInput style={styles.input} value={type} onChangeText={(t) => setType(t as 'income' | 'expense')} placeholder="income o expense" />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear Categoría</Text>}
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
