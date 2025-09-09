import React, { useContext, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ClientsContext } from '@/contexts/ClientsContext';
import { JobsContext } from '@/contexts/JobsContext';
import { deleteQueueItem, getAllQueueItems } from '@/src/database/syncQueueDB';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface QueueItem {
  id: number;
  table_name: string;
  op: string;
  record_id?: number;
  local_temp_id?: number;
  payload_json?: string;
  request_id?: string;
  nonce?: string;
  status: string;
  last_error?: string;
  timestamp?: number;
}

export default function SyncQueuePage() {
  const { processQueue: processClientsQueue, clearQueue: clearClientsQueue } = useContext(ClientsContext);
  const { processQueue: processJobsQueue, clearQueue: clearJobsQueue } = useContext(JobsContext);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const processAll = async () => {
    await processJobsQueue();
    await processClientsQueue();
    await loadQueue();
  };

  const clearAll = async () => {
    await clearJobsQueue();
    await clearClientsQueue();
    await loadQueue();
  };

  const removeItem = async (id: number) => {
    await deleteQueueItem(id);
    await loadQueue();
  };

  const showDetails = (item: QueueItem) => {
    Alert.alert('Detalles de la operación', JSON.stringify(item, null, 2));
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <FlatList
        data={queue}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.item, { borderBottomColor: borderColor }]}>
            <TouchableOpacity style={styles.itemContent} onPress={() => showDetails(item)}>
              <ThemedText>Tabla: {item.table_name}</ThemedText>
              <ThemedText>Operación: {item.op}</ThemedText>
              <ThemedText>ID Registro: {item.record_id ?? '-'}</ThemedText>
              <ThemedText>ID Temp: {item.local_temp_id ?? '-'}</ThemedText>
              <ThemedText>Estado: {item.status}</ThemedText>
              <ThemedText>
                Creado: {item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: buttonColor }]}
              onPress={() => removeItem(item.id)}
            >
              <ThemedText style={{ color: buttonTextColor }}>Eliminar</ThemedText>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<ThemedText>No hay operaciones en la cola</ThemedText>}
      />
      <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={processAll}>
        <ThemedText style={{ color: buttonTextColor }}>Reintentar</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={clearAll}>
        <ThemedText style={{ color: buttonTextColor }}>Borrar cola</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  item: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: { flex: 1 },
  deleteButton: { padding: 8, borderRadius: 4 },
  button: { marginTop: 16, padding: 12, borderRadius: 8, alignItems: 'center' },
});
