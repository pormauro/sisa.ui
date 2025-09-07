// app/categories/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { CategoriesContext, Category } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CategoriesScreen() {
  const { categories, loadCategories, deleteCategory } = useContext(CategoriesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');

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

  const categoryTree = useMemo(() => {
    const buildTree = (cats: Category[], parentId: number | null = null) =>
      cats
        .filter(c => c.parent_id === parentId)
        .map(c => ({ ...c, children: buildTree(cats, c.id) }));
    return buildTree(filteredCategories);
  }, [filteredCategories]);

  const displayCategories = useMemo(() => {
    const flatten = (nodes: any[], level = 0): (Category & { level: number })[] => {
      let res: (Category & { level: number })[] = [];
      nodes.forEach(n => {
        res.push({ ...n, level });
        if (n.children && n.children.length) {
          res = res.concat(flatten(n.children, level + 1));
        }
      });
      return res;
    };
    return flatten(categoryTree);
  }, [categoryTree]);

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

  const renderItem = ({ item }: { item: Category & { level: number } }) => (
    <TouchableOpacity
      style={[styles.item, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/categories/viewModal?id=${item.id}`)}
      onLongPress={() => router.push(`/categories/${item.id}`)}
    >
      <View style={[styles.itemInfo, { paddingLeft: item.level * 16 }]}>
        <ThemedText style={[styles.name, item.level === 0 ? styles.parent : null]}>
          {item.name}
        </ThemedText>
        <ThemedText>{item.type}</ThemedText>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? (
            <ActivityIndicator color={spinnerColor} />
          ) : (
            <ThemedText style={styles.deleteText}>🗑️</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}> 
      <TextInput
        style={[
          styles.search,
          {
            backgroundColor: inputBackground,
            color: inputTextColor,
            borderColor: borderColor,
          },
        ]}
        placeholder="Buscar categoría..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={displayCategories}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>No se encontraron categorías</ThemedText>
        }
      />
      {canAdd && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/categories/create')}>
          <ThemedText style={styles.addText}>➕ Agregar Categoría</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  search: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemInfo: { flex: 1 },
  name: { fontSize: 16 },
  parent: { fontWeight: 'bold' },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  addText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
