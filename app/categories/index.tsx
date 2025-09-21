// app/categories/index.tsx
import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { DisplayCategory, getDisplayCategories } from '@/utils/categories';

type CategorySection = {
  title: string;
  type: 'income' | 'expense';
  data: DisplayCategory[];
};

export default function CategoriesScreen() {
  const { categories, loadCategories, deleteCategory } = useContext(CategoriesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const typeFilterItems = useMemo(
    () => [
      { label: 'Todos', value: 'all' },
      { label: 'Ingresos', value: 'income' },
      { label: 'Gastos', value: 'expense' },
    ],
    []
  );

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const sectionHeaderBackground = useThemeColor({ light: '#f3f3f8', dark: '#1f1f2a' }, 'background');
  const incomeSectionColor = useThemeColor({ light: '#2f855a', dark: '#9ae6b4' }, 'text');
  const expenseSectionColor = useThemeColor({ light: '#c53030', dark: '#feb2b2' }, 'text');

  useEffect(() => {
    if (!permissions.includes('listCategories')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver categorías.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (!permissions.includes('listCategories')) {
        return;
      }
      void loadCategories();
    }, [permissions, loadCategories])
  );

  const fuse = new Fuse(categories, { keys: ['name'] });
  const filteredCategories = useMemo(() => {
    if (!search) return categories;
    const result = fuse.search(search);
    return result.map(r => r.item);
  }, [search, categories]);

  const categorySections = useMemo<CategorySection[]>(() => {
    const sections: CategorySection[] = [];

    const pushSection = (type: 'income' | 'expense', title: string) => {
      if (typeFilter !== 'all' && typeFilter !== type) {
        return;
      }

      const data = getDisplayCategories(filteredCategories, type);
      if (data.length) {
        sections.push({ title, type, data });
      }
    };

    pushSection('income', 'Ingresos');
    pushSection('expense', 'Gastos');

    return sections;
  }, [filteredCategories, typeFilter]);

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

  const renderItem = ({ item }: { item: DisplayCategory }) => (
    <TouchableOpacity
      style={[styles.item, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/categories/viewModal?id=${item.id}`)}
      onLongPress={() => router.push(`/categories/${item.id}`)}
    >
      <View style={[styles.itemInfo, { paddingLeft: item.level * 16 }]}> 
        <ThemedText style={[styles.name, item.level === 0 ? styles.parent : null]}>
          {item.name}
        </ThemedText>
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

  const renderSectionHeader = ({ section }: { section: CategorySection }) => {
    const accentColor = section.type === 'income' ? incomeSectionColor : expenseSectionColor;

    return (
      <View
        style={[
          styles.sectionHeader,
          {
            backgroundColor: sectionHeaderBackground,
            borderColor: accentColor,
          },
        ]}
      >
        <ThemedText style={[styles.sectionHeaderText, { color: accentColor }]}>
          {section.title}
        </ThemedText>
      </View>
    );
  };

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
      <SearchableSelect
        style={styles.filterSelect}
        items={typeFilterItems}
        selectedValue={typeFilter}
        onValueChange={(value) => {
          const nextValue = (value ?? 'all') as string;
          if (nextValue === 'income' || nextValue === 'expense' || nextValue === 'all') {
            setTypeFilter(nextValue);
          }
        }}
        placeholder="Filtrar por tipo"
        showSearch={false}
      />
      <SectionList
        sections={categorySections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={[
          styles.listContent,
          categorySections.length === 0 && styles.emptyListContent,
        ]}
        ListFooterComponent={<View style={{ height: canAdd ? 120 : 0 }} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.empty}>No se encontraron categorías</ThemedText>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
      />
      {canAdd && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/categories/create')}
        >
          <ThemedText style={[styles.addText, { color: addButtonTextColor }]}>➕ Agregar Categoría</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  search: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  filterSelect: { marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemInfo: { flex: 1 },
  name: { fontSize: 16 },
  parent: { fontWeight: 'bold' },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionHeaderText: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  addText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', paddingVertical: 32 },
  empty: { textAlign: 'center', fontSize: 16 },
  listContent: { paddingBottom: 16, paddingTop: 4 },
  emptyListContent: { flexGrow: 1, justifyContent: 'center' },
});
