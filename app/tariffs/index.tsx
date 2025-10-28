import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  FlatList,
  TouchableOpacity,
  View,
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
import { TariffsContext, Tariff } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useCachedState } from '@/hooks/useCachedState';

type TariffSortOption = 'name' | 'amount' | 'last_update';

const SORT_OPTIONS: { label: string; value: TariffSortOption }[] = [
  { label: 'Nombre', value: 'name' },
  { label: 'Monto', value: 'amount' },
  { label: 'Última actualización', value: 'last_update' },
];

const getTimestamp = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function TariffsScreen() {
  const { tariffs, loadTariffs, deleteTariff } = useContext(TariffsContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [search, setSearch] = useCachedState<string>('tariffsFilters.searchQuery', '');
  const [selectedSort, setSelectedSort] = useCachedState<TariffSortOption>(
    'tariffsFilters.selectedSort',
    'last_update'
  );
  const [sortDirection, setSortDirection] = useCachedState<'asc' | 'desc'>(
    'tariffsFilters.sortDirection',
    'desc'
  );
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!permissions.includes('listTariffs')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver tarifas.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (!permissions.includes('listTariffs')) {
        return;
      }
      void loadTariffs();
    }, [permissions, loadTariffs])
  );

  const fuse = useMemo(
    () =>
      new Fuse(tariffs, {
        keys: ['name'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [tariffs]
  );

  const filteredTariffs = useMemo(() => {
    const baseList = (() => {
      if (!search.trim()) {
        return tariffs;
      }
      return fuse.search(search.trim()).map(result => result.item);
    })();

    const items = [...baseList];

    const comparator: ((a: Tariff, b: Tariff) => number) | null = (() => {
      switch (selectedSort) {
        case 'name':
          return (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'amount':
          return (a, b) => a.amount - b.amount;
        case 'last_update':
        default:
          return (a, b) => getTimestamp(a.last_update) - getTimestamp(b.last_update);
      }
    })();

    if (comparator) {
      items.sort((a, b) => {
        const comparison = comparator(a, b);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [fuse, tariffs, search, selectedSort, sortDirection]);

  const canDelete = permissions.includes('deleteTariff');
  const canAdd = permissions.includes('addTariff');

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Confirmar eliminación', '¿Deseas eliminar esta tarifa?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            const success = await deleteTariff(id);
            setLoadingId(null);
            if (!success) {
              Alert.alert('Error', 'No se pudo eliminar la tarifa.');
            }
          },
        },
      ]);
    },
    [deleteTariff, setLoadingId]
  );

  const handleSelectSort = useCallback(
    (option: TariffSortOption) => {
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
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Última actualización',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const buttonBackgroundColor = useThemeColor({}, 'button');
  const modalSelectedBackground = useThemeColor({ light: '#f9fafb', dark: '#1f2937' }, 'background');

  const renderItem = ({ item }: { item: Tariff }) => (
    <TouchableOpacity
      style={[styles.item, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/tariffs/viewModal?id=${item.id}`)}
      onLongPress={() => router.push(`/tariffs/${item.id}`)}
    >
      <View style={styles.itemInfo}>
        <ThemedText style={styles.name}>{item.name}</ThemedText>
        <ThemedText>${item.amount}</ThemedText>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <ThemedText style={styles.deleteText}>🗑️</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.searchRow}>
        <TextInput
          style={[
            styles.search,
            { borderColor, backgroundColor: inputBackground, color: textColor },
          ]}
          placeholder="Buscar tarifa..."
          placeholderTextColor={placeholderColor}
          value={search}
          onChangeText={setSearch}
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
            color={textColor}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: inputBackground, borderColor }]}
          onPress={() => setIsFilterModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Abrir opciones de filtro"
        >
          <Ionicons name="filter" size={20} color={textColor} />
        </TouchableOpacity>
      </View>
      <View style={styles.filterSummaryRow}>
        <ThemedText style={styles.filterSummaryText}>
          Ordenado por {currentSortLabel} · {sortDirectionLabel}
        </ThemedText>
      </View>
      <FlatList
        data={filteredTariffs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: canAdd ? 120 : 0 }} />}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>No se encontraron tarifas</ThemedText>
        }
      />
      {canAdd && (
        <ThemedButton
          title="➕ Agregar Tarifa"
          onPress={() => router.push('/tariffs/create')}
          style={[styles.addButton, { backgroundColor: buttonBackgroundColor }]}
          textStyle={{ color: buttonTextColor, fontSize: 16, fontWeight: 'bold' }}
        />
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
            <ThemedText style={styles.modalTitle}>Ordenar por</ThemedText>
            <View style={styles.modalSection}>
              {SORT_OPTIONS.map(option => {
                const isSelected = option.value === selectedSort;
                const selectedStyle = isSelected
                  ? {
                      borderColor: buttonBackgroundColor,
                      backgroundColor: modalSelectedBackground,
                    }
                  : undefined;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.modalOption, selectedStyle]}
                    onPress={() => handleSelectSort(option.value)}
                  >
                    <ThemedText
                      style={[
                        styles.modalOptionText,
                        isSelected && { color: buttonTextColor, fontWeight: '600' },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: buttonBackgroundColor }]}
              onPress={() => setIsFilterModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar filtro"
            >
              <Ionicons name="close" size={20} color={buttonTextColor} />
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
  search: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12, marginRight: 8 },
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
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: { position: 'absolute', right: 16, bottom: 32, borderRadius: 50, padding: 16 },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 16 },
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
