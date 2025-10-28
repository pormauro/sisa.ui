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
import { CashBoxesContext, CashBox } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useCachedState } from '@/hooks/useCachedState';

type CashBoxSortOption = 'name' | 'created' | 'updated';

const SORT_OPTIONS: { label: string; value: CashBoxSortOption }[] = [
  { label: 'Nombre', value: 'name' },
  { label: 'Fecha de creación', value: 'created' },
  { label: 'Última modificación', value: 'updated' },
];

const getTimestamp = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function CashBoxesScreen() {
  const { cashBoxes, loadCashBoxes, deleteCashBox } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useCachedState<string>('cashBoxesFilters.searchQuery', '');
  const [selectedSort, setSelectedSort] = useCachedState<CashBoxSortOption>(
    'cashBoxesFilters.selectedSort',
    'updated'
  );
  const [sortDirection, setSortDirection] = useCachedState<'asc' | 'desc'>(
    'cashBoxesFilters.sortDirection',
    'desc'
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

  useEffect(() => {
    if (!permissions.includes('listCashBoxes')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver las cajas.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (!permissions.includes('listCashBoxes')) {
        return;
      }
      void loadCashBoxes();
    }, [permissions, loadCashBoxes])
  );

  const fuse = useMemo(() => new Fuse(cashBoxes, { keys: ['name'] }), [cashBoxes]);

  const filteredCashBoxes = useMemo(() => {
    const baseList = (() => {
      if (!searchQuery.trim()) {
        return cashBoxes;
      }
      return fuse.search(searchQuery.trim()).map(result => result.item);
    })();

    const items = [...baseList];

    const comparator: ((a: CashBox, b: CashBox) => number) | null = (() => {
      switch (selectedSort) {
        case 'name':
          return (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'created':
          return (a, b) => {
            const aValue = getTimestamp((a as { created_at?: string | null }).created_at) || a.id;
            const bValue = getTimestamp((b as { created_at?: string | null }).created_at) || b.id;
            return aValue - bValue;
          };
        case 'updated':
        default:
          return (a, b) => {
            const aValue =
              getTimestamp(
                (a as { updated_at?: string | null; created_at?: string | null }).updated_at ??
                  (a as { created_at?: string | null }).created_at
              ) || a.id;
            const bValue =
              getTimestamp(
                (b as { updated_at?: string | null; created_at?: string | null }).updated_at ??
                  (b as { created_at?: string | null }).created_at
              ) || b.id;
            return aValue - bValue;
          };
      }
    })();

    if (comparator) {
      items.sort((a, b) => {
        const comparison = comparator(a, b);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [cashBoxes, fuse, searchQuery, selectedSort, sortDirection]);

  const canDeleteCashBox = permissions.includes('deleteCashBox');

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert(
        'Confirmar eliminación',
        '¿Está seguro de que desea eliminar esta caja?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              setLoadingId(id);
              const success = await deleteCashBox(id);
              setLoadingId(null);
              if (!success) {
                Alert.alert('Error', 'No se pudo eliminar la caja');
              }
            },
          },
        ]
      );
    },
    [deleteCashBox, setLoadingId]
  );

  const handleSelectSort = useCallback(
    (option: CashBoxSortOption) => {
      setSelectedSort(option);
      if (option === 'name') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
      setIsFilterModalVisible(false);
    },
    [setSelectedSort, setSortDirection, setIsFilterModalVisible]
  );

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Última modificación',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const renderItem = ({ item }: { item: CashBox }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`./cash_boxes/${item.id}`)}
      onLongPress={() => router.push(`./cash_boxes/${item.id}`)}
    >
      <CircleImagePicker fileId={item.image_file_id} size={50} />
      <View style={styles.itemInfo}>
        <ThemedText style={styles.itemTitle}>{item.name}</ThemedText>
      </View>
      {canDeleteCashBox && (
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
          placeholder="Buscar caja..."
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
        data={filteredCashBoxes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: 120 }} />}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron cajas</ThemedText>
        }
      />
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: addButtonColor }]}
        onPress={() => router.push('/cash_boxes/create')}
      >
        <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Caja</ThemedText>
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
            <ThemedText style={styles.modalTitle}>Ordenar por</ThemedText>
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
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: addButtonColor }]}
              onPress={() => setIsFilterModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar filtro"
            >
              <Ionicons name="close" size={20} color={addButtonTextColor} />
            </TouchableOpacity>
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
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
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
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
