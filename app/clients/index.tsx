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

export default function ClientsListPage() {
  const { clients, loadClients, deleteClient } = useContext(ClientsContext);
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const { jobs } = useContext(JobsContext);
  const { tariffs } = useContext(TariffsContext);
  const { statuses } = useContext(StatusesContext);
  const [searchQuery, setSearchQuery] = useState('');

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');

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
    if (!searchQuery) return clients;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [clients, fuse, searchQuery]);

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
              <ThemedText style={styles.amountLabel}>Total no facturado</ThemedText>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
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
});
