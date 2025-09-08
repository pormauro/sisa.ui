import React, { useContext, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { ClientsContext } from '@/contexts/ClientsContext';
import { JobsContext } from '@/contexts/JobsContext';
import { getAllQueueItems } from '@/src/database/syncQueueDB';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface QueueItem {
  id: number;
  table_name: string;
  op: string;
  status: string;
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

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <FlatList
        data={queue}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.item, { borderBottomColor: borderColor }]}>
            <ThemedText>{item.table_name} - {item.op}</ThemedText>
            <ThemedText>{item.status}</ThemedText>
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
  item: { paddingVertical: 8, borderBottomWidth: 1 },
  button: { marginTop: 16, padding: 12, borderRadius: 8, alignItems: 'center' },
});
