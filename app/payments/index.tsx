// app/payments/index.tsx
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
import { PaymentsContext, Payment } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { DaySeparator } from '@/components/DaySeparator';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useCachedState } from '@/hooks/useCachedState';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { withDaySeparators, type DaySeparatedItem } from '@/utils/daySeparators';

type PaymentSortOption = 'date' | 'amount' | 'creditor' | 'description';

type PaymentListItem = Payment & {
  creditorDisplayName: string;
};

const SORT_OPTIONS: { label: string; value: PaymentSortOption }[] = [
  { label: 'Fecha del pago', value: 'date' },
  { label: 'Monto', value: 'amount' },
  { label: 'Acreedor', value: 'creditor' },
  { label: 'Descripción', value: 'description' },
];

const fuseOptions: Fuse.IFuseOptions<PaymentListItem> = {
  keys: [
    { name: 'creditorDisplayName', weight: 0.5 },
    { name: 'description', weight: 0.3 },
    { name: 'creditor_other', weight: 0.2 },
    { name: 'paid_with_account', weight: 0.2 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
};

export default function PaymentsScreen() {
  const { payments, loadPayments, deletePayment } = useContext(PaymentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useCachedState<string>('paymentsFilters.searchQuery', '');
  const [selectedSort, setSelectedSort] = useCachedState<PaymentSortOption>(
    'paymentsFilters.selectedSort',
    'date'
  );
  const [sortDirection, setSortDirection] = useCachedState<'asc' | 'desc'>(
    'paymentsFilters.sortDirection',
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

  const canList = permissions.includes('listPayments');
  const { refreshing, handleRefresh } = usePullToRefresh(loadPayments, canList);

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver pagos.');
      router.back();
    }
  }, [canList, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      void loadPayments();
    }, [canList, loadPayments])
  );

  const paymentsWithCreditor = useMemo<PaymentListItem[]>(() => {
    const getCreditorDisplayName = (payment: Payment): string => {
      if (payment.creditor_type === 'client') {
        const client = clients.find(c => c.id === payment.creditor_client_id);
        return client?.business_name?.trim() || 'Cliente sin nombre';
      }
      if (payment.creditor_type === 'provider') {
        const provider = providers.find(p => p.id === payment.creditor_provider_id);
        return provider?.business_name?.trim() || 'Proveedor sin nombre';
      }
      return payment.creditor_other?.trim() || 'Sin acreedor';
    };

    return payments.map(payment => ({
      ...payment,
      creditorDisplayName: getCreditorDisplayName(payment),
    }));
  }, [payments, clients, providers]);

  const fuse = useMemo(() => new Fuse(paymentsWithCreditor, fuseOptions), [paymentsWithCreditor]);

  const filteredPayments = useMemo(() => {
    const baseList = (() => {
      if (!searchQuery.trim()) {
        return paymentsWithCreditor;
      }
      return fuse.search(searchQuery.trim()).map(result => result.item);
    })();

    const items = [...baseList];

    const getTimestamp = (value?: string | null) => {
      if (!value) {
        return 0;
      }

      const normalized = value.trim();
      if (!normalized) {
        return 0;
      }

      const isoLike = normalized.includes(' ') ? normalized.replace(' ', 'T') : normalized;
      const parsedIso = Date.parse(isoLike);
      if (Number.isFinite(parsedIso)) {
        return parsedIso;
      }

      const manualMatch =
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(normalized);
      if (manualMatch) {
        const [, year, month, day, hours = '00', minutes = '00', seconds = '00'] = manualMatch;
        const fallbackDate = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hours),
          Number(minutes),
          Number(seconds),
        );
        const time = fallbackDate.getTime();
        if (Number.isFinite(time)) {
          return time;
        }
      }

      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const getAmount = (value: number | null | undefined) =>
      typeof value === 'number' && Number.isFinite(value) ? value : 0;

    const comparator: ((a: PaymentListItem, b: PaymentListItem) => number) | null = (() => {
      switch (selectedSort) {
        case 'amount':
          return (a, b) => getAmount(a.price) - getAmount(b.price);
        case 'creditor':
          return (a, b) =>
            a.creditorDisplayName.localeCompare(b.creditorDisplayName, undefined, { sensitivity: 'base' });
        case 'description':
          return (a, b) => (a.description ?? '').localeCompare(b.description ?? '', undefined, {
            sensitivity: 'base',
          });
        case 'date':
        default:
          return (a, b) => getTimestamp(a.payment_date) - getTimestamp(b.payment_date);
      }
    })();

    if (comparator) {
      items.sort((a, b) => {
        const comparison = comparator(a, b);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [fuse, paymentsWithCreditor, searchQuery, selectedSort, sortDirection]);

  const canDelete = permissions.includes('deletePayment');
  const canAdd = permissions.includes('addPayment');

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Confirmar eliminación', '¿Eliminar este pago?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            await deletePayment(id);
            setLoadingId(null);
          },
        },
      ]);
    },
    [deletePayment, setLoadingId]
  );

  const handleSelectSort = useCallback(
    (option: PaymentSortOption) => {
      setSelectedSort(option);
      if (option === 'creditor' || option === 'description') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
      setIsFilterModalVisible(false);
    },
    [setSelectedSort, setSortDirection, setIsFilterModalVisible]
  );

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Fecha del pago',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const paymentsWithSeparators = useMemo(
    () => withDaySeparators(filteredPayments, payment => payment.payment_date ?? payment.created_at ?? null),
    [filteredPayments]
  );

  const renderItem = ({ item }: { item: DaySeparatedItem<PaymentListItem> }) => {
    if (item.type === 'separator') {
      return <DaySeparator label={item.label} />;
    }

    const payment = item.value;
    const total = payment.price;
    return (
      <TouchableOpacity
        style={[styles.item, { borderColor: itemBorderColor }]}
        onPress={() => router.push(`/payments/viewModal?id=${payment.id}`)}
        onLongPress={() => router.push(`/payments/${payment.id}`)}
      >
        <View style={styles.itemInfo}>
          <ThemedText style={styles.name}>{payment.creditorDisplayName}</ThemedText>
          <ThemedText>{payment.description || 'Sin descripción'}</ThemedText>
          <ThemedText>Total: ${total}</ThemedText>
        </View>
        {canDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(payment.id)}
          >
            {loadingId === payment.id ? (
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
          placeholder="Buscar pago..."
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
        data={paymentsWithSeparators}
        keyExtractor={(item) =>
          item.type === 'separator' ? `separator-${item.id}` : item.value.id.toString()
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: canAdd ? 120 : 0 }} />}
        ListEmptyComponent={<ThemedText style={styles.empty}>No se encontraron pagos</ThemedText>}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      {canAdd && (
        <TouchableOpacity style={[styles.addButton, { backgroundColor: addButtonColor }]} onPress={() => router.push('/payments/create')}>
          <ThemedText style={[styles.addText, { color: addButtonTextColor }]}>➕ Agregar Pago</ThemedText>
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
