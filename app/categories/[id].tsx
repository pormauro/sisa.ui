// app/categories/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { getDisplayCategories } from '@/utils/categories';

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
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);

  const displayCategories = useMemo(
    () => getDisplayCategories(categories),
    [categories]
  );

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
      setParentId(category.parent_id ? String(category.parent_id) : '');
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
          const success = await updateCategory(categoryId, {
            name,
            type,
            parent_id: parentId ? parseInt(parentId, 10) : null,
          });
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

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={type}
          onValueChange={(val) => setType(val as 'income' | 'expense')}
          style={styles.picker}
        >
          <Picker.Item label="Ingreso" value="income" />
          <Picker.Item label="Gasto" value="expense" />
        </Picker>
      </View>

      <Text style={styles.label}>Categoría padre</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={parentId}
          onValueChange={setParentId}
          style={styles.picker}
        >
          <Picker.Item label="-- Sin padre --" value="" />
          {displayCategories
            .filter(c => c.id !== categoryId)
            .map(c => (
              <Picker.Item
                key={c.id}
                label={`${' '.repeat(c.level * 2)}${c.name}`}
                value={c.id.toString()}
              />
            ))}
        </Picker>
      </View>

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
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  picker: { height: 50, width: '100%' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#007bff', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
