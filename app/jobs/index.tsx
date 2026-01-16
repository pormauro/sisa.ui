// C:/Users/Mauri/Documents/GitHub/router/app/jobs/index.tsx
import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DaySeparator } from '@/components/DaySeparator';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
// Importamos el contexto de clientes
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { formatTimeInterval } from '@/utils/time';
import { sortByNewest } from '@/utils/sort';
import { formatCurrency } from '@/utils/currency';
import { withDaySeparators, type DaySeparatedItem } from '@/utils/daySeparators';

type SortField = 'updatedAt' | 'jobDate' | 'clientName' | 'status';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Nombre del cliente', value: 'clientName' },
  { label: 'Fecha del trabajo', value: 'jobDate' },
  { label: 'Estado', value: 'status' },
  { label: 'Última modificación', value: 'updatedAt' },
];

export default function JobsScreen() {
  const { jobs, loadJobs, deleteJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { statuses } = useContext(StatusesContext);
  const { clients } = useContext(ClientsContext); // Accedemos al contexto de clientes
  const { tariffs } = useContext(TariffsContext);
  const { folders } = useContext(FoldersContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('jobDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filtersVisible, setFiltersVisible] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const itemTextColor = useThemeColor({}, 'text');
  const spinnerColor = useThemeColor({}, 'tint');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');

  const canListJobs = permissions.includes('listJobs');
  const { refreshing, handleRefresh } = usePullToRefresh(loadJobs, canListJobs);

  useEffect(() => {
    if (!canListJobs) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver trabajos.');
      router.back();
    }
  }, [canListJobs, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canListJobs) {
        return;
      }
      void loadJobs();
    }, [canListJobs, loadJobs])
  );

  const fuse = useMemo(() => new Fuse(jobs, { keys: ['description', 'type_of_work'] }), [jobs]);
  const filteredJobs = useMemo(() => {
    if (!search) return jobs;
    const result = fuse.search(search);
    return result.map(r => r.item);
  }, [search, jobs, fuse]);

  const getJobUpdatedValue = useCallback((job: Job) => {
    if (job.updated_at) return job.updated_at;
    if (job.created_at) return job.created_at;
    return job.job_date ?? job.id;
  }, []);

  const getJobDateValue = useCallback((job: Job) => {
    if (!job.job_date) return job.id;
    const time = job.start_time
      ? job.start_time.length === 5
        ? `${job.start_time}:00`
        : job.start_time
      : '00:00:00';
    return `${job.job_date}T${time}`;
  }, []);

  // Función para obtener el nombre del cliente según el client_id
  const getClientName = useCallback(
    (clientId: number | null): string | undefined => {
      if (clientId == null) return undefined;
      const client = clients.find(client => client.id === clientId);
      return client ? client.business_name : undefined; // Usamos business_name para el nombre
    },
    [clients]
  );

  const sortedJobs = useMemo(() => {
    if (sortField === 'clientName') {
      const items = [...filteredJobs];
      items.sort((a, b) => {
        const aName = (getClientName(a.client_id) ?? '').trim();
        const bName = (getClientName(b.client_id) ?? '').trim();
        const comparison = aName.localeCompare(bName, undefined, { sensitivity: 'base' });
        if (comparison !== 0) {
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        return sortDirection === 'asc' ? a.id - b.id : b.id - a.id;
      });
      return items;
    }

    if (sortField === 'status') {
      const statusOrder = new Map(statuses.map(status => [status.id, status.order_index]));
      const items = [...filteredJobs];
      items.sort((a, b) => {
        const aOrder = statusOrder.get(a.status_id ?? -1) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = statusOrder.get(b.status_id ?? -1) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) {
          return sortDirection === 'asc' ? aOrder - bOrder : bOrder - aOrder;
        }
        return sortDirection === 'asc' ? a.id - b.id : b.id - a.id;
      });
      return items;
    }

    const list =
      sortField === 'updatedAt'
        ? sortByNewest(filteredJobs, getJobUpdatedValue)
        : sortByNewest(filteredJobs, getJobDateValue);
    return sortDirection === 'asc' ? [...list].reverse() : list;
  }, [
    filteredJobs,
    sortField,
    sortDirection,
    getJobUpdatedValue,
    getJobDateValue,
    getClientName,
    statuses,
  ]);

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === sortField)?.label ?? 'Fecha del trabajo',
    [sortField]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const handleSelectSort = useCallback((option: SortField) => {
    setSortField(option);
    if (option === 'clientName' || option === 'status') {
      setSortDirection('asc');
    } else {
      setSortDirection('desc');
    }
    setFiltersVisible(false);
  }, []);

  // Función para buscar el objeto status que corresponda al trabajo
  const getJobStatus = (job: Job): Status | undefined => {
    if (job.status_id == null) return undefined;
    return statuses.find(s => s.id === job.status_id);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Eliminar trabajo', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          setLoadingId(id);
          const success = await deleteJob(id);
          setLoadingId(null);
          if (!success)
            Alert.alert('Error', 'No se pudo eliminar el trabajo.');
        }
      }
    ]);
  };

  const jobsWithSeparators = useMemo(
    () => withDaySeparators(sortedJobs, job => job.job_date ?? job.updated_at ?? job.created_at ?? null),
    [sortedJobs]
  );

  const renderItem = ({ item }: { item: DaySeparatedItem<Job> }) => {
    if (item.type === 'separator') {
      return <DaySeparator label={item.label} />;
    }

    const job = item.value;
    const jobStatus = getJobStatus(job);
    const clientName = getClientName(job.client_id); // Usamos client_id para obtener el nombre del cliente
    const folderName = job.folder_id ? folders.find(folder => folder.id === job.folder_id)?.name : null;
    const extractDate = (d?: string | null) => (d && d.includes(' ') ? d.split(' ')[0] : d || '');
    const extractTime = (t?: string | null) => {
      if (!t) return '';
      const [datePart, timePart] = t.trim().split(' ');
      const rawTime = timePart ?? datePart;
      if (!rawTime) return '';
      const [hours, minutes] = rawTime.split(':');
      return minutes != null ? `${hours}:${minutes}` : rawTime;
    };
    const dateStr = extractDate(job.job_date);
    const startStr = extractTime(job.start_time);
    const endStr = extractTime(job.end_time);
    const intervalStr = formatTimeInterval(startStr, endStr);
    const manualRate =
      typeof job.manual_amount === 'number' && Number.isFinite(job.manual_amount)
        ? job.manual_amount
        : null;

    const tariffRate = job.tariff_id
      ? tariffs.find(t => t.id === job.tariff_id)?.amount ?? null
      : null;

    const hasExplicitRate = manualRate !== null || tariffRate !== null;
    const appliedRate = manualRate ?? tariffRate ?? 0;
    let cost: number | null = null;
    if (hasExplicitRate && startStr && endStr) {
      const start = new Date(`1970-01-01T${startStr}`);
      const end = new Date(`1970-01-01T${endStr}`);
      const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0) {
        cost = diffHours * appliedRate;
      }
    }

    const costLabel = cost !== null
      ? `Costo estimado: ${formatCurrency(cost)}`
      : hasExplicitRate
        ? `Tarifa por hora: ${formatCurrency(appliedRate)}`
        : 'Costo sin tarifa configurada';

    const itemTextStyle = { color: jobStatus ? '#fff' : itemTextColor };
    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { borderColor: itemBorderColor, backgroundColor: jobStatus ? jobStatus.background_color : itemBackground }
        ]}
        onPress={() => router.push(`/jobs/viewModal?id=${job.id}`)}
        onLongPress={() => router.push(`/jobs/${job.id}`)}
      >
        <View style={styles.itemContent}>
          {/* Cliente */}
          <ThemedText style={[styles.title, itemTextStyle]}>
            {clientName ? clientName : 'Cliente desconocido'}
          </ThemedText>

          {/* Descripción */}
          {job.description ? (
            <ThemedText style={[styles.subTitle, itemTextStyle]}>{job.description}</ThemedText>
          ) : null}

          {/* Carpeta */}
          <ThemedText style={[styles.folder, itemTextStyle]}>
            Carpeta: {folderName ?? 'Sin carpeta'}
          </ThemedText>

          {/* Fecha y horario */}
          {(dateStr || startStr || endStr) && (
            <ThemedText style={[styles.date, itemTextStyle]}>
              {`${dateStr} ${startStr} - ${endStr}${intervalStr ? ` (${intervalStr})` : ''}`}
            </ThemedText>
          )}
          <ThemedText style={[styles.cost, itemTextStyle]}>{costLabel}</ThemedText>
        </View>
        <View style={styles.itemRight}>
          <ThemedText style={[styles.statusText, itemTextStyle]}>
            {jobStatus ? jobStatus.label : `Estado: ${job.status_id ?? 'N/A'}`}
          </ThemedText>
          <TouchableOpacity onPress={() => handleDelete(job.id)}>
            {loadingId === job.id ? (
              <ActivityIndicator color={spinnerColor} />
            ) : (
              <ThemedText style={[styles.trash, itemTextStyle]}>🗑️</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.searchRow}>
        <TextInput
          style={[
            styles.search,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor }
          ]}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar trabajo..."
          placeholderTextColor={placeholderColor}
        />
        <TouchableOpacity
          style={[
            styles.sortDirectionButton,
            { backgroundColor: inputBackground, borderColor }
          ]}
          onPress={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
        >
          <Ionicons
            name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={inputTextColor}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: inputBackground, borderColor }
          ]}
          onPress={() => setFiltersVisible(true)}
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
        data={jobsWithSeparators}
        keyExtractor={(item) =>
          item.type === 'separator' ? `separator-${item.id}` : item.value.id.toString()
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: 120 }} />}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>No hay trabajos cargados</ThemedText>
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: addButtonColor }]}
        onPress={() => router.push('/jobs/create')}
      >
        <ThemedText style={[styles.addText, { color: addButtonTextColor }]}>
          ➕ Nuevo Trabajo
        </ThemedText>
      </TouchableOpacity>
      <Modal
        animationType="slide"
        transparent
        visible={filtersVisible}
        onRequestClose={() => setFiltersVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: inputBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Filtro</ThemedText>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: addButtonColor }]}
                onPress={() => setFiltersVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar filtro"
              >
                <Ionicons name="close" size={20} color={addButtonTextColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSection}>
              {SORT_OPTIONS.map(option => {
                const isSelected = sortField === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.modalOption,
                      { borderColor },
                      isSelected && { borderColor: addButtonColor },
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
    marginBottom: 12
  },
  search: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12
  },
  filterButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sortDirectionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterSummaryRow: {
    marginBottom: 12
  },
  filterSummaryText: {
    fontSize: 13,
    fontWeight: '600'
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff'
  },
  itemContent: { flex: 1, marginRight: 10 },
  itemRight: { justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontWeight: 'bold', fontSize: 16 },
  subTitle: { fontSize: 14, marginVertical: 4 },
  folder: { fontSize: 12, marginBottom: 4 },
  date: { fontSize: 12 },
  cost: { fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  statusText: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  trash: { fontSize: 18, paddingHorizontal: 12 },
  addButton: {
    padding: 16,
    borderRadius: 30,
    position: 'absolute',
    right: 16,
    bottom: 47,
    alignItems: 'center'
  },
  addText: { fontWeight: 'bold', fontSize: 16 },
  empty: { marginTop: 20, textAlign: 'center', fontSize: 16 },
  listContent: { paddingBottom: 16 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalContent: {
    borderRadius: 12,
    padding: 16
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSection: { marginBottom: 12 },
  modalOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8
  },
  modalOptionText: { fontSize: 14, textAlign: 'center' },
  modalCloseButton: {
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
