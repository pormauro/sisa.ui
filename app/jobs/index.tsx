// C:/Users/Mauri/Documents/GitHub/router/app/jobs/index.tsx
import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
// Importamos el contexto de clientes
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { formatTimeInterval } from '@/utils/time';
import { sortByNewest } from '@/utils/sort';

type SortField = 'updatedAt' | 'jobDate';
type SortDirection = 'asc' | 'desc';

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
  const [sortField, setSortField] = useState<SortField>('updatedAt');
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

  useEffect(() => {
    if (!permissions.includes('listJobs')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver trabajos.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (!permissions.includes('listJobs')) {
        return;
      }
      void loadJobs();
    }, [permissions, loadJobs])
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

  const sortedJobs = useMemo(() => {
    const list =
      sortField === 'updatedAt'
        ? sortByNewest(filteredJobs, getJobUpdatedValue)
        : sortByNewest(filteredJobs, getJobDateValue);
    return sortDirection === 'asc' ? [...list].reverse() : list;
  }, [filteredJobs, sortField, sortDirection, getJobUpdatedValue, getJobDateValue]);

  const toggleDirection = () => {
    setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Función para buscar el objeto status que corresponda al trabajo
  const getJobStatus = (job: Job): Status | undefined => {
    if (job.status_id == null) return undefined;
    return statuses.find(s => s.id === job.status_id);
  };

  // Función para obtener el nombre del cliente según el client_id
  const getClientName = (clientId: number | null): string | undefined => {
    if (clientId == null) return undefined;
    const client = clients.find(client => client.id === clientId);
    return client ? client.business_name : undefined; // Usamos business_name para el nombre
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

  const renderItem = ({ item }: { item: Job }) => {
    const jobStatus = getJobStatus(item);
    const clientName = getClientName(item.client_id); // Usamos client_id para obtener el nombre del cliente
    const folderName = item.folder_id ? folders.find(folder => folder.id === item.folder_id)?.name : null;
    const extractDate = (d?: string | null) => (d && d.includes(' ') ? d.split(' ')[0] : d || '');
    const extractTime = (t?: string | null) => {
      if (!t) return '';
      const [datePart, timePart] = t.trim().split(' ');
      const rawTime = timePart ?? datePart;
      if (!rawTime) return '';
      const [hours, minutes] = rawTime.split(':');
      return minutes != null ? `${hours}:${minutes}` : rawTime;
    };
    const dateStr = extractDate(item.job_date);
    const startStr = extractTime(item.start_time);
    const endStr = extractTime(item.end_time);
    const intervalStr = formatTimeInterval(startStr, endStr);
    const manualRate =
      typeof item.manual_amount === 'number' && Number.isFinite(item.manual_amount)
        ? item.manual_amount
        : null;

    const tariffRate = item.tariff_id
      ? tariffs.find(t => t.id === item.tariff_id)?.amount ?? null
      : null;

    const rate = manualRate ?? tariffRate ?? 0;
    let cost = 0;
    if (startStr && endStr && rate) {
      const start = new Date(`1970-01-01T${startStr}`);
      const end = new Date(`1970-01-01T${endStr}`);
      const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      cost = diffHours > 0 ? diffHours * rate : 0;
    }

    const itemTextStyle = { color: jobStatus ? '#fff' : itemTextColor };
    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { borderColor: itemBorderColor, backgroundColor: jobStatus ? jobStatus.background_color : itemBackground }
        ]}
        onPress={() => router.push(`/jobs/viewModal?id=${item.id}`)}
        onLongPress={() => router.push(`/jobs/${item.id}`)}
      >
        <View style={styles.itemContent}>
          {/* Cliente */}
          <ThemedText style={[styles.title, itemTextStyle]}>
            {clientName ? clientName : 'Cliente desconocido'}
          </ThemedText>

          {/* Descripción */}
          {item.description ? (
            <ThemedText style={[styles.subTitle, itemTextStyle]}>{item.description}</ThemedText>
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
          {cost > 0 && (
            <ThemedText style={[styles.cost, itemTextStyle]}>Costo: ${cost.toFixed(2)}</ThemedText>
          )}
        </View>
        <View style={styles.itemRight}>
          <ThemedText style={[styles.statusText, itemTextStyle]}>
            {jobStatus ? jobStatus.label : `Estado: ${item.status_id ?? 'N/A'}`}
          </ThemedText>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            {loadingId === item.id ? (
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
            styles.filterButton,
            { backgroundColor: inputBackground, borderColor }
          ]}
          onPress={() => setFiltersVisible(true)}
        >
          <Ionicons name="filter" size={20} color={inputTextColor} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={sortedJobs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: 120 }} />}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>No hay trabajos cargados</ThemedText>
        }
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
            <ThemedText style={styles.modalTitle}>Filtros y orden</ThemedText>
            <View style={styles.modalSection}>
              <ThemedText style={styles.modalSectionTitle}>Ordenar por</ThemedText>
              <View style={styles.sortButtons}>
                <TouchableOpacity
                  style={[
                    styles.sortButton,
                    { borderColor },
                    sortField === 'updatedAt' && { borderColor: addButtonColor }
                  ]}
                  onPress={() => setSortField('updatedAt')}
                >
                  <ThemedText style={styles.sortButtonText}>Actualización</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sortButton,
                    { borderColor },
                    sortField === 'jobDate' && { borderColor: addButtonColor }
                  ]}
                  onPress={() => setSortField('jobDate')}
                >
                  <ThemedText style={styles.sortButtonText}>Fecha del trabajo</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.sortDirection, { borderColor }]}
              onPress={toggleDirection}
            >
              <ThemedText style={styles.sortDirectionText}>
                {sortDirection === 'asc' ? 'Ascendente ⬆️' : 'Descendente ⬇️'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: addButtonColor }]}
              onPress={() => setFiltersVisible(false)}
            >
              <ThemedText style={[styles.modalCloseButtonText, { color: addButtonTextColor }]}>
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
  sortButtons: { flexDirection: 'row', flexShrink: 1, flexWrap: 'wrap' as const },
  sortButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8
  },
  sortButtonText: { fontSize: 12, fontWeight: '500' },
  sortDirection: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignItems: 'center'
  },
  sortDirectionText: { fontSize: 12, fontWeight: '600' },
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
    bottom: 32,
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  modalSection: { marginBottom: 12 },
  modalSectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  modalCloseButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalCloseButtonText: { fontWeight: 'bold', fontSize: 14 }
});
