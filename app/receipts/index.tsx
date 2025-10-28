// app/receipts/index.tsx
import React, { useContext, useEffect, useMemo, useCallback, useState } from 'react';
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
import { ReceiptsContext, Receipt } from '@/contexts/ReceiptsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useCachedState } from '@/hooks/useCachedState';

type ReceiptSortOption = 'date' | 'amount' | 'payer' | 'description';

type ReceiptListItem = Receipt & {
  payerDisplayName: string;
};

const SORT_OPTIONS: { label: string; value: ReceiptSortOption }[] = [
  { label: 'Fecha del recibo', value: 'date' },
  { label: 'Monto', value: 'amount' },
  { label: 'Pagador', value: 'payer' },
  { label: 'Descripción', value: 'description' },
];

const fuseOptions: Fuse.IFuseOptions<ReceiptListItem> = {
  keys: [
    { name: 'payerDisplayName', weight: 0.5 },
    { name: 'description', weight: 0.3 },
    { name: 'payer_other', weight: 0.2 },
    { name: 'paid_in_account', weight: 0.2 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
};

export default function ReceiptsScreen() {
  const { receipts, loadReceipts, deleteReceipt } = useContext(ReceiptsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useCachedState<string>('receiptsFilters.searchQuery', '');
  const [selectedSort, setSelectedSort] = useCachedState<ReceiptSortOption>(
    'receiptsFilters.selectedSort',
    'date'
  );
  const [sortDirection, setSortDirection] = useCachedState<'asc' | 'desc'>(
    'receiptsFilters.sortDirection',
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
  const spinnerColor = useThemeColor({}, 'tint');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');

  useEffect(() => {
    if (!permissions.includes('listReceipts')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver recibos.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (!permissions.includes('listReceipts')) {
        return;
      }
      void loadReceipts();
    }, [permissions, loadReceipts])
  );

  const receiptsWithPayer = useMemo<ReceiptListItem[]>(() => {
    const getPayerDisplayName = (receipt: Receipt): string => {
      if (receipt.payer_type === 'client') {
        const client = clients.find(c => c.id === receipt.payer_client_id);
        return client?.business_name?.trim() || 'Cliente sin nombre';
      }
      if (receipt.payer_type === 'provider') {
        const provider = providers.find(p => p.id === receipt.payer_provider_id);
        return provider?.business_name?.trim() || 'Proveedor sin nombre';
      }
      return receipt.payer_other?.trim() || 'Sin pagador';
    };

    return receipts.map(receipt => ({
      ...receipt,
      payerDisplayName: getPayerDisplayName(receipt),
    }));
  }, [receipts, clients, providers]);

  const fuse = useMemo(() => new Fuse(receiptsWithPayer, fuseOptions), [receiptsWithPayer]);

  const filteredReceipts = useMemo(() => {
    const baseList = (() => {
      if (!searchQuery.trim()) {
        return receiptsWithPayer;
      }
      return fuse.search(searchQuery.trim()).map(result => result.item);
    })();

    const items = [...baseList];

    const getTimestamp = (value?: string | null) => {
      if (!value) {
        return 0;
      }
      const parsed = Date.parse(value.includes(' ') ? value.replace(' ', 'T') : value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const getAmount = (value: number | null | undefined) =>
      typeof value === 'number' && Number.isFinite(value) ? value : 0;

    const comparator: ((a: ReceiptListItem, b: ReceiptListItem) => number) | null = (() => {
      switch (selectedSort) {
        case 'amount':
          return (a, b) => getAmount(a.price) - getAmount(b.price);
        case 'payer':
          return (a, b) =>
            a.payerDisplayName.localeCompare(b.payerDisplayName, undefined, { sensitivity: 'base' });
        case 'description':
          return (a, b) => (a.description ?? '').localeCompare(b.description ?? '', undefined, {
            sensitivity: 'base',
          });
        case 'date':
        default:
          return (a, b) => getTimestamp(a.receipt_date) - getTimestamp(b.receipt_date);
      }
    })();

    if (comparator) {
      items.sort((a, b) => {
        const comparison = comparator(a, b);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [fuse, receiptsWithPayer, searchQuery, selectedSort, sortDirection]);

  const canDelete = permissions.includes('deleteReceipt');
  const canAdd = permissions.includes('addReceipt');

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Confirmar eliminación', '¿Eliminar este recibo?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            await deleteReceipt(id);
            setLoadingId(null);
          },
        },
      ]);
    },
    [deleteReceipt, setLoadingId]
  );

  const handleSelectSort = useCallback(
    (option: ReceiptSortOption) => {
      setSelectedSort(option);
      if (option === 'payer' || option === 'description') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
      setIsFilterModalVisible(false);
    },
    [setIsFilterModalVisible, setSelectedSort, setSortDirection]
  );

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Fecha del recibo',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const renderItem = ({ item }: { item: ReceiptListItem }) => {
    const total = item.price;
    return (
      <TouchableOpacity
        style={[styles.item, { borderColor: itemBorderColor }]}
        onPress={() => router.push(`/receipts/viewModal?id=${item.id}`)}
        onLongPress={() => router.push(`/receipts/${item.id}`)}
      >
        <View style={styles.itemInfo}>
          <ThemedText style={styles.name}>{item.payerDisplayName}</ThemedText>
          <ThemedText>{item.description || 'Sin descripción'}</ThemedText>
          <ThemedText>Total: ${total}</ThemedText>
        </View>
        {canDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
          >
            {loadingId === item.id ? (
              <ActivityIndicator color={spinnerColor} />
            ) : (
              <ThemedText style={styles.deleteText}>🗑️</ThemedText>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.searchRow}>
        <TextInput
          style={[
            styles.search,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          placeholder="Buscar recibo..."
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
        data={filteredReceipts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: canAdd ? 120 : 0 }} />}
        ListEmptyComponent={<ThemedText style={styles.empty}>No se encontraron recibos</ThemedText>}
      />
      {canAdd && (
        <TouchableOpacity style={[styles.addButton, { backgroundColor: addButtonColor }]} onPress={() => router.push('/receipts/create')}>
          <ThemedText style={[styles.addText, { color: addButtonTextColor }]}>➕ Agregar Recibo</ThemedText>
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
  addButton: { position: 'absolute', right: 16, bottom: 32, padding: 16, borderRadius: 50, alignItems: 'center' },
  addText: { fontSize: 16, fontWeight: 'bold' },
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
