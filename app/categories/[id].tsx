// app/categories/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { getDisplayCategories } from '@/utils/categories';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';

export default function CategoryDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updateCategory');
  const canDelete = permissions.includes('deleteCategory');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const { categories, loadCategories, updateCategory, deleteCategory } = useContext(CategoriesContext);

  const category = categories.find(c => c.id === categoryId);

  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const displayCategories = useMemo(
    () => getDisplayCategories(categories),
    [categories]
  );

  const typeItems = useMemo(
    () => [
      { label: 'Ingreso', value: 'income' },
      { label: 'Gasto', value: 'expense' },
    ],
    []
  );

  const parentItems = useMemo(
    () => [
      { label: '-- Sin padre --', value: '' },
      ...displayCategories
        .filter(c => c.id !== categoryId)
        .map(c => ({
          label: `${' '.repeat(c.level * 2)}${c.name}`,
          value: c.id.toString(),
        })),
    ],
    [displayCategories, categoryId]
  );

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a esta categoría.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (category) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setName(category.name);
      setType(category.type);
      setParentId(category.parent_id ? String(category.parent_id) : '');
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadCategories()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [category, hasAttemptedLoad, isFetchingItem, loadCategories]);

  if (!category) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={spinnerColor} />
        ) : (
          <ThemedText>Categoría no encontrada</ThemedText>
        )}
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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={name}
        onChangeText={setName}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Tipo</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={typeItems}
        selectedValue={type}
        onValueChange={(val) => setType((val as 'income' | 'expense') ?? type)}
        placeholder="Selecciona tipo"
        showSearch={false}
        disabled={!canEdit}
      />

      <ThemedText style={styles.label}>Categoría padre</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={parentItems}
        selectedValue={parentId}
        onValueChange={(value) => setParentId(value?.toString() ?? '')}
        placeholder="-- Sin padre --"
        disabled={!canEdit}
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value) return;
          router.push(`/categories/${value}`);
        }}
      />

      {canEdit && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUpdate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar</ThemedText>
          )}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Eliminar</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  select: {
    marginBottom: 8,
  },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#007bff', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
