// app/categories/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { CategoriesContext, Category } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CategoriesScreen() {
  const { categories, loadCategories, deleteCategory } = useContext(CategoriesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!permissions.includes('listCategories')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver categorías.');
      router.back();
    } else {
      loadCategories();
    }
  }, [permissions]);

  const fuse = new Fuse(categories, { keys: ['name'] });
  const filteredCategories = useMemo(() => {
    if (!search) return categories;
    const result = fuse.search(search);
    return result.map(r => r.item);
  }, [search, categories]);

  const canDelete = permissions.includes('deleteCategory');
  const canAdd = permissions.includes('addCategory');

  const handleDelete = (id: number) => {
    Alert.alert('Confirmar eliminación', '¿Eliminar esta categoría?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoadingId(id);
          await deleteCategory(id);
          setLoadingId(null);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Category }) => (
    <TouchableOpacity style={styles.item} onLongPress={() => router.push(`/categories/${item.id}`)}>
      <View style={styles.itemInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text>{item.type}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? <ActivityIndicator /> : <Text style={styles.deleteText}>🗑️</Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Buscar categoría..."
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No se encontraron categorías</Text>}
      />
      {canAdd && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/categories/create')}>
          <Text style={styles.addText}>➕ Agregar Categoría</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  search: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  itemInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: { position: 'absolute', right: 16, bottom: 32, backgroundColor: '#007BFF', padding: 16, borderRadius: 50, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
