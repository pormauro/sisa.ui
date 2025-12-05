// app/providers/index.tsx
import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProvidersContext, Provider } from '@/contexts/ProvidersContext';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

type ProviderSortOption = 'name' | 'created' | 'updated';

const SORT_OPTIONS: { label: string; value: ProviderSortOption }[] = [
  { label: 'Nombre', value: 'name' },
  { label: 'Fecha de creación', value: 'created' },
  { label: 'Última modificación', value: 'updated' },
];

export default function ProvidersListPage() {
  const { providers, loadProviders, deleteProvider } = useContext(ProvidersContext);
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedSort, setSelectedSort] = useState<ProviderSortOption>('updated');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const spinnerColor = useThemeColor({}, 'tint');

  const canAdd = permissions.includes('addProvider');
  const canDelete = permissions.includes('deleteProvider');
  const canEdit = permissions.includes('updateProvider');

  const canList = permissions.includes('listProviders');
  const { refreshing, handleRefresh } = usePullToRefresh(loadProviders, canList);

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver proveedores.');
      router.back();
    }
  }, [canList, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      void loadProviders();
    }, [canList, loadProviders])
  );

  const fuse = useMemo(
    () =>
      new Fuse(providers, {
        keys: ['business_name', 'tax_id', 'email'],
      }),
    [providers]
  );

  const filteredProviders = useMemo(() => {
    const baseList = (() => {
      if (!searchQuery) {
        return providers;
      }
      const results = fuse.search(searchQuery);
      return results.map(result => result.item);
    })();

    const items = [...baseList];

    const getTimestamp = (value?: string | null) => {
      if (!value) {
        return 0;
      }
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    const comparator: ((a: Provider, b: Provider) => number) | null = (() => {
      switch (selectedSort) {
        case 'name':
          return (a, b) =>
            (a.business_name ?? '').localeCompare(b.business_name ?? '', undefined, {
              sensitivity: 'base',
            });
        case 'created':
          return (a, b) => getTimestamp(a.created_at) - getTimestamp(b.created_at);
        case 'updated':
        default:
          return (a, b) =>
            getTimestamp(a.updated_at ?? a.created_at) - getTimestamp(b.updated_at ?? b.created_at);
      }
    })();

    if (comparator) {
      items.sort((a, b) => {
        const comparison = comparator(a, b);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [providers, fuse, searchQuery, selectedSort, sortDirection]);

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Última modificación',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const handleSelectSort = useCallback((option: ProviderSortOption) => {
    setSelectedSort(option);
    if (option === 'name') {
      setSortDirection('asc');
    } else {
      setSortDirection('desc');
    }
    setIsFilterModalVisible(false);
  }, []);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Confirmar eliminación', '¿Eliminar este proveedor?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            await deleteProvider(id);
            setLoadingId(null);
          },
        },
      ]);
    },
    [deleteProvider]
  );

  const handleDeleteProvider = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      handleDelete(id);
    },
    [handleDelete]
  );

  const renderItem = ({ item }: { item: Provider }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/providers/viewModal?id=${item.id}`)}
      onLongPress={() => canEdit && router.push(`/providers/${item.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.itemContent}>
        <CircleImagePicker fileId={item.profile_file_id} size={50} />
        <View style={styles.itemInfo}>
          <ThemedText style={styles.itemTitle}>{item.business_name}</ThemedText>
          {item.email ? (
            <ThemedText style={styles.itemSubtitle}>{item.email}</ThemedText>
          ) : null}
        </View>
      </View>

      {canDelete && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(event) => handleDeleteProvider(event, item.id)}
          >
            {loadingId === item.id ? (
              <ActivityIndicator color={spinnerColor} />
            ) : (
              <ThemedText style={styles.actionText}>🗑️</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar proveedor..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[
            styles.searchInput,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
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
          accessibilityLabel="Abrir opciones de orden"
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
        data={filteredProviders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron proveedores</ThemedText>
        }
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: canAdd ? 120 : 0 }} />}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      {canAdd && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/providers/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Proveedor</ThemedText>
        </TouchableOpacity>
      )}
      <Modal
        transparent
        animationType="fade"
        visible={isFilterModalVisible}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsFilterModalVisible(false)} />
          <View
            style={[styles.modalContent, { backgroundColor: inputBackground, borderColor }]}
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
  container: { flex: 1, padding: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
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
  listContent: {
    paddingBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  itemSubtitle: { fontSize: 14, marginTop: 2 },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: { padding: 6, marginLeft: 4 },
  actionText: { fontSize: 18 },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 47,
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
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
    borderColor: 'transparent',
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalCloseButton: {
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
