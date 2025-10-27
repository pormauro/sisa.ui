// /app/clients/index.tsx
import React, { useContext, useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  GestureResponderEvent,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { useClientFinalizedJobTotals } from '@/hooks/useClientFinalizedJobTotals';

type ClientFilter =
  | 'all'
  | 'unbilledJobs'
  | 'unpaidInvoices'
  | 'name'
  | 'created'
  | 'updated';

const FILTER_OPTIONS: { label: string; value: ClientFilter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Trabajos no facturados', value: 'unbilledJobs' },
  { label: 'Facturas impagas', value: 'unpaidInvoices' },
  { label: 'Nombre', value: 'name' },
  { label: 'Creado', value: 'created' },
  { label: 'Modificado', value: 'updated' },
];

export default function ClientsListPage() {
  const { clients, loadClients, deleteClient } = useContext(ClientsContext);
  const { getTotalForClient } = useClientFinalizedJobTotals();
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ClientFilter>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const metricCardBackground = useThemeColor(
    { light: '#f3f4f6', dark: '#1f2937' },
    'background'
  );
  const metricCardBorder = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');
  const metricLabelColor = useThemeColor({ light: '#4b5563', dark: '#d1d5db' }, 'text');

  const canAddClient = permissions.includes('addClient');
  const canDeleteClient = permissions.includes('deleteClient');
  const canEditClient = permissions.includes('updateClient');

  useFocusEffect(
    useCallback(() => {
      void loadClients();
    }, [loadClients])
  );

  const clientsWithComputedTotals = useMemo(
    () =>
      clients.map(client => {
        const computedTotal = getTotalForClient(client.id);
        const currentTotal = typeof client.unbilled_total === 'number' ? client.unbilled_total : 0;

        if (currentTotal === computedTotal) {
          return client;
        }

        if (computedTotal === 0 && (client.unbilled_total == null || client.unbilled_total === 0)) {
          return client;
        }

        return {
          ...client,
          unbilled_total: computedTotal,
        };
      }),
    [clients, getTotalForClient]
  );

  const fuse = useMemo(
    () =>
      new Fuse(clientsWithComputedTotals, {
        keys: ['business_name', 'tax_id', 'email', 'address'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [clientsWithComputedTotals]
  );

  const filteredClients = useMemo(() => {
    const baseClients = searchQuery
      ? fuse.search(searchQuery).map(result => result.item)
      : clientsWithComputedTotals;

    let result = [...baseClients];

    const getTimestamp = (value?: string | null) => {
      if (!value) {
        return 0;
      }
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    const getSafeTotal = (value: number | null | undefined) =>
      typeof value === 'number' && Number.isFinite(value) ? value : 0;

    let comparator: ((a: Client, b: Client) => number) | null = null;

    switch (selectedFilter) {
      case 'unbilledJobs':
        result = result.filter(client => getSafeTotal(client.unbilled_total) > 0);
        comparator = (a, b) =>
          getSafeTotal(a.unbilled_total) - getSafeTotal(b.unbilled_total);
        break;
      case 'unpaidInvoices':
        result = result.filter(client => getSafeTotal(client.unpaid_invoices_total) > 0);
        comparator = (a, b) =>
          getSafeTotal(a.unpaid_invoices_total) - getSafeTotal(b.unpaid_invoices_total);
        break;
      case 'name':
        comparator = (a, b) =>
          (a.business_name ?? '').localeCompare(b.business_name ?? '', undefined, {
            sensitivity: 'base',
          });
        break;
      case 'created':
        comparator = (a, b) => getTimestamp(a.created_at) - getTimestamp(b.created_at);
        break;
      case 'updated':
        comparator = (a, b) => getTimestamp(a.updated_at) - getTimestamp(b.updated_at);
        break;
      case 'all':
      default:
        comparator = (a, b) =>
          getTimestamp(a.updated_at ?? a.created_at) - getTimestamp(b.updated_at ?? b.created_at);
        break;
    }

    if (comparator) {
      result.sort((a, b) => {
        const comparison = comparator?.(a, b) ?? 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [clientsWithComputedTotals, fuse, searchQuery, selectedFilter, sortDirection]);

  const currentFilterLabel = useMemo(
    () => FILTER_OPTIONS.find(option => option.value === selectedFilter)?.label ?? 'Todos',
    [selectedFilter]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const handleSelectFilter = useCallback((filter: ClientFilter) => {
    setSelectedFilter(filter);
    if (filter === 'name') {
      setSortDirection('asc');
    } else {
      setSortDirection('desc');
    }
    setIsFilterModalVisible(false);
  }, []);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar este cliente?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              await deleteClient(id);
            },
          },
        ]
      );
    },
    [deleteClient]
  );

  const handleDeleteClient = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      handleDelete(id);
    },
    [handleDelete]
  );

  const renderItem = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/clients/viewModal?id=${item.id}`)}
      onLongPress={() => canEditClient && router.push(`/clients/${item.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.itemContent}>
        <CircleImagePicker fileId={item.brand_file_id} size={50} />
        <View style={styles.itemInfo}>
          <ThemedText style={styles.itemTitle}>
            {item.business_name && item.business_name.trim().length > 0
              ? item.business_name
              : 'Cliente sin nombre'}
          </ThemedText>
          {item.tax_id ? (
            <ThemedText style={styles.itemSubtitle}>CUIT: {item.tax_id}</ThemedText>
          ) : null}
          {item.address ? (
            <ThemedText style={styles.itemSubtitle}>{item.address}</ThemedText>
          ) : null}
          {item.email ? (
            <ThemedText style={styles.itemSubtitle}>{item.email}</ThemedText>
          ) : null}
          <View style={styles.metricsRow}>
            <View
              style={[
                styles.metricCard,
                styles.metricCardSpacer,
                { backgroundColor: metricCardBackground, borderColor: metricCardBorder },
              ]}
            >
              <ThemedText style={[styles.metricLabel, { color: metricLabelColor }]}>Trabajos</ThemedText>
              <ThemedText style={styles.metricValue}>
                {formatCurrency(item.unbilled_total)}
              </ThemedText>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: metricCardBackground, borderColor: metricCardBorder },
              ]}
            >
              <ThemedText style={[styles.metricLabel, { color: metricLabelColor }]}>Facturas</ThemedText>
              <ThemedText style={styles.metricValue}>
                {formatCurrency(item.unpaid_invoices_total)}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {canDeleteClient && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(event) => handleDeleteClient(event, item.id)}
          >
            <ThemedText style={styles.actionText}>🗑️</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[
            styles.searchInput,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          placeholderTextColor={placeholderColor}
        />
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: inputBackground, borderColor }]}
          onPress={() => setIsFilterModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Abrir filtros de clientes"
        >
          <Ionicons name="filter" size={20} color={inputTextColor} />
        </TouchableOpacity>
      </View>
      <View style={styles.filterSummaryRow}>
        <ThemedText style={styles.filterSummaryText}>
          {currentFilterLabel} · {sortDirectionLabel}
        </ThemedText>
      </View>
      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron clientes</ThemedText>
        }
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: canAddClient ? 120 : 0 }} />}
      />
      {canAddClient && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/clients/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Cliente</ThemedText>
        </TouchableOpacity>
      )}
      <Modal
        transparent
        animationType="fade"
        visible={isFilterModalVisible}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsFilterModalVisible(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: inputBackground, borderColor }]}>
            <ThemedText style={styles.modalTitle}>Filtros y orden</ThemedText>
            <View style={styles.modalSection}>
              <ThemedText style={styles.modalSectionTitle}>Filtrar por</ThemedText>
              {FILTER_OPTIONS.map(option => {
                const isSelected = option.value === selectedFilter;
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
                    onPress={() => handleSelectFilter(option.value)}
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
            <View style={styles.modalSection}>
              <ThemedText style={styles.modalSectionTitle}>Dirección</ThemedText>
              <TouchableOpacity
                style={[styles.sortDirectionButton, { borderColor }]}
                onPress={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              >
                <ThemedText style={styles.sortDirectionText}>
                  {sortDirection === 'asc' ? 'Ascendente ⬆️' : 'Descendente ⬇️'}
                </ThemedText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: addButtonColor }]}
              onPress={() => setIsFilterModalVisible(false)}
            >
              <ThemedText
                style={[styles.modalCloseButtonText, { color: addButtonTextColor }]}
              >
                Aplicar filtros
              </ThemedText>
            </TouchableOpacity>
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
  filterButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSummaryRow: {
    marginBottom: 12,
    alignItems: 'flex-start',
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
  metricsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 72,
  },
  metricCardSpacer: {
    marginRight: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.85,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
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
    bottom: 32,
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
    maxWidth: 360,
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
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
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
  sortDirectionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  sortDirectionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalCloseButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
