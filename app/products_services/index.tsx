import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ProductsServicesContext, ProductService } from '@/contexts/ProductsServicesContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useCachedState } from '@/hooks/useCachedState';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

type ProductServiceSortOption = 'description' | 'category' | 'price' | 'cost';

const SORT_OPTIONS: { label: string; value: ProductServiceSortOption }[] = [
  { label: 'Descripción', value: 'description' },
  { label: 'Categoría', value: 'category' },
  { label: 'Precio', value: 'price' },
  { label: 'Costo', value: 'cost' },
];

const getNumeric = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export default function ProductsServicesScreen() {
  const { productsServices, loadProductsServices, deleteProductService } = useContext(ProductsServicesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useCachedState<string>('productsServicesFilters.searchQuery', '');
  const [selectedSort, setSelectedSort] = useCachedState<ProductServiceSortOption>(
    'productsServicesFilters.selectedSort',
    'description'
  );
  const [sortDirection, setSortDirection] = useCachedState<'asc' | 'desc'>(
    'productsServicesFilters.sortDirection',
    'asc'
  );
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const spinnerColor = useThemeColor({}, 'tint');

  const canList = permissions.includes('listProductsServices');
  const { refreshing, handleRefresh } = usePullToRefresh(loadProductsServices, canList);

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver productos y servicios.');
      router.back();
    }
  }, [canList, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      void loadProductsServices();
    }, [canList, loadProductsServices])
  );

  const fuse = useMemo(
    () =>
      new Fuse(productsServices, {
        keys: ['description', 'category', 'item_type'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [productsServices]
  );

  const filteredItems = useMemo(() => {
    const baseList = (() => {
      if (!searchQuery.trim()) {
        return productsServices;
      }
      return fuse.search(searchQuery.trim()).map(result => result.item);
    })();

    const items = [...baseList];

    const comparator: ((a: ProductService, b: ProductService) => number) | null = (() => {
      switch (selectedSort) {
        case 'category':
          return (a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' });
        case 'price':
          return (a, b) => getNumeric(a.price) - getNumeric(b.price);
        case 'cost':
          return (a, b) => getNumeric(a.cost) - getNumeric(b.cost);
        case 'description':
        default:
          return (a, b) => a.description.localeCompare(b.description, undefined, { sensitivity: 'base' });
      }
    })();

    if (comparator) {
      items.sort((a, b) => {
        const comparison = comparator(a, b);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [fuse, productsServices, searchQuery, selectedSort, sortDirection]);

  const canDelete = permissions.includes('deleteProductService');

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar este ítem?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              setLoadingId(id);
              const success = await deleteProductService(id);
              setLoadingId(null);
              if (!success) {
                Alert.alert('Error', 'No se pudo eliminar el producto/servicio');
              }
            },
          },
        ]
      );
    },
    [deleteProductService, setLoadingId]
  );

  const handleSelectSort = useCallback(
    (option: ProductServiceSortOption) => {
      setSelectedSort(option);
      if (option === 'price' || option === 'cost') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
      setIsFilterModalVisible(false);
    },
    [setSelectedSort, setSortDirection, setIsFilterModalVisible]
  );

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Descripción',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const renderItem = ({ item }: { item: ProductService }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onLongPress={() => router.push(`./products_services/${item.id}`)}
    >
      <CircleImagePicker fileId={item.product_image_file_id} size={50} />
      <View style={styles.itemInfo}>
        <ThemedText style={styles.itemTitle}>{item.description}</ThemedText>
        <ThemedText>${item.price}</ThemedText>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? (
            <ActivityIndicator color={spinnerColor} />
          ) : (
            <ThemedText style={styles.deleteText}>🗑</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}> 
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar producto o servicio..."
          style={[
            styles.searchInput,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={placeholderColor}
        />
        <TouchableOpacity
          style={[styles.sortDirectionButton, { backgroundColor: inputBackground, borderColor }]}
          onPress={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
          accessibilityRole="button"
          accessibilityLabel="Cambiar dirección de orden"
        >
          <Ionicons
            name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={inputTextColor}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: inputBackground, borderColor }]}
          onPress={() => setIsFilterModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Abrir opciones de filtro"
        >
          <Ionicons name="filter" size={20} color={inputTextColor} />
        </TouchableOpacity>
      </View>
      <View style={styles.filterSummaryRow}>
        <ThemedText style={styles.filterSummaryText}>
          Ordenado por {currentSortLabel} · {sortDirectionLabel}
        </ThemedText>
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: 120 }} />}
        ListEmptyComponent={<ThemedText style={styles.emptyText}>No se encontraron registros</ThemedText>}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: addButtonColor }]}
        onPress={() => router.push('/products_services/create')}
      >
        <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar</ThemedText>
      </TouchableOpacity>
      <Modal
        transparent
        animationType="fade"
        visible={isFilterModalVisible}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsFilterModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: inputBackground, borderColor }]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Filtro</ThemedText>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: addButtonColor }]}
                onPress={() => setIsFilterModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar filtro"
              >
                <Ionicons name="close" size={20} color={addButtonTextColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSection}>
              {SORT_OPTIONS.map(option => {
                const isSelected = option.value === selectedSort;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.modalOption,
                      isSelected && {
                        borderColor: addButtonColor,
                        backgroundColor: background,
                      },
                    ]}
                    onPress={() => handleSelectSort(option.value)}
                  >
                    <ThemedText
                      style={[
                        styles.modalOptionText,
                        isSelected && { color: addButtonColor, fontWeight: '600' },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12, marginRight: 8 },
  sortDirectionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  filterButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSummaryRow: {
    marginBottom: 12,
  },
  filterSummaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
  listContent: { paddingBottom: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSection: {
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 15,
  },
  modalCloseButton: {
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
