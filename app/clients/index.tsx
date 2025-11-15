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
import { InvoicesContext } from '@/contexts/InvoicesContext';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { useClientFinalizedJobTotals } from '@/hooks/useClientFinalizedJobTotals';
import { useClientInvoiceSummary } from '@/hooks/useClientInvoiceSummary';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

type ClientSortOption =
  | 'name'
  | 'created'
  | 'updated'
  | 'finalizedJobs';

const SORT_OPTIONS: { label: string; value: ClientSortOption }[] = [
  { label: 'Nombre', value: 'name' },
  { label: 'Fecha de creación', value: 'created' },
  { label: 'Última modificación', value: 'updated' },
  { label: 'Trabajos finalizados', value: 'finalizedJobs' },
];

export default function ClientsListPage() {
  const { clients, loadClients, deleteClient } = useContext(ClientsContext);
  const { loadInvoices } = useContext(InvoicesContext);
  const { getTotalForClient, hasFinalizedJobs } = useClientFinalizedJobTotals();
  const { getSummary: getInvoiceSummary } = useClientInvoiceSummary();
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState<ClientSortOption>('updated');
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
  const canViewJobs = permissions.includes('listJobs');
  const canViewInvoices = permissions.includes('listInvoices');

  const refreshClients = useCallback(async () => {
    const tasks: Array<Promise<unknown>> = [Promise.resolve(loadClients())];
    if (canViewInvoices) {
      tasks.push(Promise.resolve(loadInvoices()));
    }
    await Promise.all(tasks);
  }, [canViewInvoices, loadClients, loadInvoices]);

  const { refreshing, handleRefresh } = usePullToRefresh(refreshClients);

  useFocusEffect(
    useCallback(() => {
      void loadClients();
    }, [loadClients])
  );

  useFocusEffect(
    useCallback(() => {
      if (!canViewInvoices) {
        return;
      }
      void loadInvoices();
    }, [canViewInvoices, loadInvoices])
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
        keys: ['business_name', 'tax_id', 'email'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [clientsWithComputedTotals]
  );

  const filteredClients = useMemo(() => {
    const baseClients = searchQuery
      ? fuse.search(searchQuery).map(result => result.item)
      : clientsWithComputedTotals;

    const result = [...baseClients];

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

    switch (selectedSort) {
      case 'finalizedJobs':
        comparator = (a, b) => {
          const aHasJobs = hasFinalizedJobs(a.id) ? 1 : 0;
          const bHasJobs = hasFinalizedJobs(b.id) ? 1 : 0;
          if (aHasJobs !== bHasJobs) {
            return aHasJobs - bHasJobs;
          }
          return getSafeTotal(a.unbilled_total) - getSafeTotal(b.unbilled_total);
        };
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
  }, [
    clientsWithComputedTotals,
    fuse,
    searchQuery,
    selectedSort,
    sortDirection,
    hasFinalizedJobs,
  ]);

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Última modificación',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const handleSelectSort = useCallback((option: ClientSortOption) => {
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

  const renderItem = ({ item }: { item: Client }) => {
    const getSafeTotal = (value: number | null | undefined) =>
      typeof value === 'number' && Number.isFinite(value) ? value : 0;

    const unbilledTotal = getSafeTotal(item.unbilled_total);
    const finalizedJobsAvailable = hasFinalizedJobs(item.id);
    const invoiceSummary = canViewInvoices ? getInvoiceSummary(item.id) : null;
    const issuedTotal = invoiceSummary?.issuedTotal ?? 0;
    const draftTotal = invoiceSummary?.draftTotal ?? 0;
    const issuedCount = invoiceSummary?.issuedCount ?? 0;
    const draftCount = invoiceSummary?.draftCount ?? 0;

    const shouldShowUnbilledCard = finalizedJobsAvailable || unbilledTotal > 0;
    const shouldShowInvoiceMetrics = canViewInvoices && (issuedCount > 0 || draftCount > 0);

    const handleOpenInvoices = () => {
      if (!canViewInvoices) {
        Alert.alert('Acceso denegado', 'No tienes permiso para ver las facturas.');
        return;
      }
      router.push(`/clients/unpaidInvoices?id=${item.id}`);
    };

    const metricCards: React.ReactNode[] = [];

    if (shouldShowUnbilledCard) {
      metricCards.push(
        <TouchableOpacity
          key="unbilled"
          style={[
            styles.metricCard,
            { backgroundColor: metricCardBackground, borderColor: metricCardBorder },
            !canViewJobs && styles.metricCardDisabled,
          ]}
          activeOpacity={0.75}
          onPress={() => {
            if (!canViewJobs) {
              Alert.alert('Acceso denegado', 'No tienes permiso para ver trabajos.');
              return;
            }
            router.push(`/clients/finalizedJobs?id=${item.id}`);
          }}
          accessibilityRole="button"
          accessibilityLabel="Ver trabajos finalizados del cliente"
        >
          <ThemedText style={[styles.metricLabel, { color: metricLabelColor }]}>Trabajos</ThemedText>
          <ThemedText style={styles.metricValue}>{formatCurrency(unbilledTotal)}</ThemedText>
        </TouchableOpacity>
      );
    }

    if (shouldShowInvoiceMetrics) {
      metricCards.push(
        <TouchableOpacity
          key="issued"
          style={[
            styles.metricCard,
            { backgroundColor: metricCardBackground, borderColor: metricCardBorder },
          ]}
          activeOpacity={0.75}
          onPress={handleOpenInvoices}
          accessibilityRole="button"
          accessibilityLabel="Ver facturas emitidas del cliente"
        >
          <ThemedText style={[styles.metricLabel, { color: metricLabelColor }]}>Emitidas</ThemedText>
          <ThemedText style={styles.metricValue}>{formatCurrency(issuedTotal)}</ThemedText>
          <ThemedText style={[styles.metricMeta, { color: metricLabelColor }]}>
            {issuedCount} {issuedCount === 1 ? 'comprobante' : 'comprobantes'}
          </ThemedText>
        </TouchableOpacity>
      );
      metricCards.push(
        <TouchableOpacity
          key="draft"
          style={[
            styles.metricCard,
            { backgroundColor: metricCardBackground, borderColor: metricCardBorder },
          ]}
          activeOpacity={0.75}
          onPress={handleOpenInvoices}
          accessibilityRole="button"
          accessibilityLabel="Ver facturas en borrador del cliente"
        >
          <ThemedText style={[styles.metricLabel, { color: metricLabelColor }]}>Borradores</ThemedText>
          <ThemedText style={styles.metricValue}>{formatCurrency(draftTotal)}</ThemedText>
          <ThemedText style={[styles.metricMeta, { color: metricLabelColor }]}>
            {draftCount} {draftCount === 1 ? 'borrador' : 'borradores'}
          </ThemedText>
        </TouchableOpacity>
      );
    }

    const shouldShowMetricsRow = metricCards.length > 0;

    return (
      <TouchableOpacity
        style={[styles.itemContainer, { borderColor: itemBorderColor }]}
        onPress={() => router.push(`/clients/viewModal?id=${item.id}`)}
        onLongPress={() => canEditClient && router.push(`/clients/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.itemHeader}>
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
              {item.email ? (
                <ThemedText style={styles.itemSubtitle}>{item.email}</ThemedText>
              ) : null}
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
        </View>

        {shouldShowMetricsRow ? <View style={styles.metricsRow}>{metricCards}</View> : null}
      </TouchableOpacity>
    );
  };

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
        data={filteredClients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron clientes</ThemedText>
        }
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: canAddClient ? 120 : 0 }} />}
        refreshing={refreshing}
        onRefresh={handleRefresh}
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
    flexDirection: 'column',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
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
    flexWrap: 'wrap',
    marginTop: 12,
    marginHorizontal: -4,
    width: '100%',
  },
  metricCard: {
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 72,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  metricCardDisabled: {
    opacity: 0.6,
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
  metricMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
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
  sortDirectionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modalCloseButton: {
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
