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
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { JobsContext } from '@/contexts/JobsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { calculateJobTotal } from '@/utils/jobCost';

type ClientFilter =
  | 'all'
  | 'finalizedJobs'
  | 'unpaidInvoices'
  | 'name'
  | 'created'
  | 'updated';

const FILTER_OPTIONS: { label: string; value: ClientFilter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Trabajos finalizados', value: 'finalizedJobs' },
  { label: 'Facturas impagas', value: 'unpaidInvoices' },
  { label: 'Nombre', value: 'name' },
  { label: 'Creado', value: 'created' },
  { label: 'Modificado', value: 'updated' },
];

export default function ClientsListPage() {
  const { clients, loadClients, deleteClient } = useContext(ClientsContext);
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const { jobs } = useContext(JobsContext);
  const { tariffs } = useContext(TariffsContext);
  const { statuses } = useContext(StatusesContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ClientFilter>('all');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const filterButtonColor = useThemeColor({}, 'button');
  const filterButtonTextColor = useThemeColor({}, 'buttonText');

  const canAddClient = permissions.includes('addClient');
  const canDeleteClient = permissions.includes('deleteClient');
  const canEditClient = permissions.includes('updateClient');

  useFocusEffect(
    useCallback(() => {
      void loadClients();
    }, [loadClients])
  );

  const fuse = useMemo(
    () =>
      new Fuse(clients, {
        keys: ['business_name', 'tax_id', 'email', 'address'],
      }),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const baseClients = searchQuery
      ? fuse.search(searchQuery).map(result => result.item)
      : clients;

    let result = [...baseClients];

    switch (selectedFilter) {
      case 'finalizedJobs':
        result = result.filter(client => (finalizedTotalsByClient[client.id] ?? 0) > 0);
        result.sort(
          (a, b) =>
            (finalizedTotalsByClient[b.id] ?? 0) - (finalizedTotalsByClient[a.id] ?? 0)
        );
        break;
      case 'unpaidInvoices':
        result = result.filter(client => (client.unpaid_invoices_total ?? 0) > 0);
        result.sort(
          (a, b) =>
            (b.unpaid_invoices_total ?? 0) - (a.unpaid_invoices_total ?? 0)
        );
        break;
      case 'name':
        result.sort((a, b) => a.business_name.localeCompare(b.business_name));
        break;
      case 'created':
        result.sort((a, b) => {
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bDate - aDate;
        });
        break;
      case 'updated':
        result.sort((a, b) => {
          const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bDate - aDate;
        });
        break;
      case 'all':
      default:
        break;
    }

    return result;
  }, [clients, fuse, searchQuery, selectedFilter, finalizedTotalsByClient]);

  const handleSelectFilter = useCallback((filter: ClientFilter) => {
    setSelectedFilter(filter);
    setIsFilterModalVisible(false);
  }, []);

  const currentFilterLabel = useMemo(
    () => FILTER_OPTIONS.find(option => option.value === selectedFilter)?.label ?? 'Todos',
    [selectedFilter]
  );

  const tariffsById = useMemo(() => {
    const map = new Map<number, number>();
    tariffs.forEach(tariff => {
      if (typeof tariff.amount === 'number' && Number.isFinite(tariff.amount)) {
        map.set(tariff.id, tariff.amount);
      }
    });
    return map;
  }, [tariffs]);

  const finalStatusIds = useMemo(() => {
    if (!statuses.length) {
      return [] as number[];
    }

    const keywords = ['finaliz', 'complet', 'cerrad', 'termin', 'finish', 'done'];

    return statuses
      .filter(status => {
        const label = status.label ? status.label.toLowerCase() : '';
        const value = status.value ? status.value.toLowerCase() : '';
        return keywords.some(keyword => label.includes(keyword) || value.includes(keyword));
      })
      .map(status => status.id);
  }, [statuses]);

  const finalizedTotalsByClient = useMemo(() => {
    if (!jobs.length || !finalStatusIds.length) {
      return {} as Record<number, number>;
    }

    const totals = new Map<number, number>();

    jobs.forEach(job => {
      if (job.status_id == null || !finalStatusIds.includes(job.status_id)) {
        return;
      }

      const manualRate =
        typeof job.manual_amount === 'number' && Number.isFinite(job.manual_amount)
          ? job.manual_amount
          : null;
      const tariffRate =
        job.tariff_id != null ? tariffsById.get(job.tariff_id) ?? null : null;
      const rate = manualRate ?? tariffRate;

      if (rate === null) {
        return;
      }

      const jobTotal = calculateJobTotal(rate, job.start_time, job.end_time);

      if (jobTotal === null) {
        return;
      }

      const previous = totals.get(job.client_id) ?? 0;
      totals.set(job.client_id, previous + jobTotal);
    });

    const result: Record<number, number> = {};
    totals.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }, [jobs, finalStatusIds, tariffsById]);

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
          <ThemedText style={styles.itemTitle}>{item.business_name}</ThemedText>
          {item.tax_id ? (
            <ThemedText style={styles.itemSubtitle}>CUIT: {item.tax_id}</ThemedText>
          ) : null}
          {item.address ? (
            <ThemedText style={styles.itemSubtitle}>{item.address}</ThemedText>
          ) : null}
          {item.email ? (
            <ThemedText style={styles.itemSubtitle}>{item.email}</ThemedText>
          ) : null}
          <View style={styles.amountContainer}>
            <View style={styles.amountRow}>
              <ThemedText style={styles.amountLabel}>Trabajos no facturados</ThemedText>
              <ThemedText style={styles.amountValue}>
                {formatCurrency(item.unbilled_total)}
              </ThemedText>
            </View>
            <View style={styles.amountRow}>
              <ThemedText style={styles.amountLabel}>Facturas impagas</ThemedText>
              <ThemedText style={styles.amountValue}>
                {formatCurrency(item.unpaid_invoices_total)}
              </ThemedText>
            </View>
            <View style={styles.amountRow}>
              <ThemedText style={styles.amountLabel}>Trabajos finalizados</ThemedText>
              <ThemedText style={styles.amountValue}>
                {formatCurrency(finalizedTotalsByClient[item.id] ?? 0)}
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
          style={[styles.filterButton, { backgroundColor: filterButtonColor }]}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <ThemedText style={[styles.filterButtonText, { color: filterButtonTextColor }]}>
            Filtro: {currentFilterLabel}
          </ThemedText>
        </TouchableOpacity>
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
            <ThemedText style={styles.modalTitle}>Filtrar por</ThemedText>
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
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsFilterModalVisible(false)}
            >
              <ThemedText style={styles.modalCloseButtonText}>Cerrar</ThemedText>
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  filterButtonText: {
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
  amountContainer: { marginTop: 8 },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  amountLabel: { fontSize: 13 },
  amountValue: { fontSize: 13, fontWeight: '600' },
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
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
