// C:/Users/Mauri/Documents/GitHub/router/app/jobs/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
// Importamos el contexto de clientes
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { formatTimeInterval } from '@/utils/time';

export default function JobsScreen() {
  const { jobs, loadJobs, deleteJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { statuses } = useContext(StatusesContext);
  const { clients } = useContext(ClientsContext); // Accedemos al contexto de clientes
  const { tariffs } = useContext(TariffsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

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
    } else {
      loadJobs();
    }
  }, [permissions]);

  const fuse = new Fuse(jobs, { keys: ['description', 'type_of_work'] });
  const filteredJobs = useMemo(() => {
    if (!search) return jobs;
    const result = fuse.search(search);
    return result.map(r => r.item);
  }, [search, jobs]);

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
    const extractDate = (d?: string | null) => (d && d.includes(' ') ? d.split(' ')[0] : d || '');
    const extractTime = (t?: string | null) => (t && t.includes(' ') ? t.split(' ')[1].slice(0,5) : t || '');
    const dateStr = extractDate(item.job_date);
    const startStr = extractTime(item.start_time);
    const endStr = extractTime(item.end_time);
    const intervalStr = formatTimeInterval(startStr, endStr);
    const rate = item.tariff_id
      ? tariffs.find(t => t.id === item.tariff_id)?.amount ?? 0
      : item.manual_amount ?? 0;
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
          {item.syncStatus === 'pending' && <ActivityIndicator color={spinnerColor} />}
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            {loadingId === item.id ? (
              <ActivityIndicator color={itemTextColor} />
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
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  search: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
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
});
