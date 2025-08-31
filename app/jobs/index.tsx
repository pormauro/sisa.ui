// C:/Users/Mauri/Documents/GitHub/router/app/jobs/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
// Importamos el contexto de clientes
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';

export default function JobsScreen() {
  const { jobs, loadJobs, deleteJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { statuses } = useContext(StatusesContext);
  const { clients } = useContext(ClientsContext); // Accedemos al contexto de clientes
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

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

    return (
      <TouchableOpacity
        style={[styles.itemContainer, jobStatus ? { backgroundColor: jobStatus.background_color } : {}]}
        onLongPress={() => router.push(`./jobs/${item.id}`)}
      >
        <View style={styles.itemContent}>
          {/* Cliente */}
          <Text style={styles.title}>{clientName ? clientName : 'Cliente desconocido'}</Text>

          {/* Descripción */}
          {item.description ? (
            <Text style={styles.subTitle}>{item.description}</Text>
          ) : null}

          {/* Fecha y horario */}
          {(dateStr || startStr || endStr) && (
            <Text style={styles.date}>{`${dateStr} ${startStr} - ${endStr}`}</Text>
          )}
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.statusText}>
            {jobStatus ? jobStatus.label : `Estado: ${item.status_id}`}
          </Text>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            {loadingId === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.trash}>🗑️</Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar trabajo..."
      />
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No hay trabajos cargados</Text>}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/jobs/create')}>
        <Text style={styles.addText}>➕ Nuevo Trabajo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  search: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 10 },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 12
  },
  itemContent: { flex: 1, marginRight: 10 },
  itemRight: { justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontWeight: 'bold', fontSize: 16 },
  subTitle: { fontSize: 14, color: '#555', marginVertical: 4 }, // Estilo para la descripción
  date: { fontSize: 12, color: '#333' },
  statusText: { fontSize: 12, color: '#fff', fontWeight: 'bold', marginBottom: 4 },
  trash: { fontSize: 18, color: 'red', paddingHorizontal: 12 },
  addButton: { 
    backgroundColor: '#007BFF', 
    padding: 16, 
    borderRadius: 30, 
    position: 'absolute', 
    right: 16, 
    bottom: 32, 
    alignItems: 'center'
  },
  addText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  empty: { marginTop: 20, textAlign: 'center', fontSize: 16 },
});
