// app/categories/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CategoryDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updateCategory');
  const canDelete = permissions.includes('deleteCategory');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const { categories, updateCategory, deleteCategory } = useContext(CategoriesContext);

  const category = categories.find(c => c.id === categoryId);

  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a esta categoría.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setType(category.type);
    }
  }, [category]);

  if (!category) {
    return (
      <View style={styles.container}>
        <Text>Categoría no encontrada</Text>
      </View>
    );
  }

  const handleUpdate = () => {
    Alert.alert('Confirmar actualización', '¿Actualizar esta categoría?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updateCategory(categoryId, { name, type, parent_id: category.parent_id });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Categoría actualizada');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar la categoría');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Confirmar eliminación', '¿Eliminar esta categoría?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteCategory(categoryId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Categoría eliminada');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar la categoría');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Tipo (income/expense)</Text>
      <TextInput style={styles.input} value={type} onChangeText={(t) => setType(t as 'income' | 'expense')} />

      {canEdit && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUpdate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Actualizar</Text>}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Eliminar</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#007bff', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
