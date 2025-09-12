import React, { useContext } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function SyncQueuePage() {
  const { queue, processQueue, clearQueue, removeQueueItem, clearDatabases } = useContext(ClientsContext);
  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <FlatList
        data={queue}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.item, { borderBottomColor: borderColor }]}>
            <View style={{ flex: 1 }}>
              <ThemedText>{item.table_name} - {item.op}</ThemedText>
              <ThemedText>{item.status}</ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: buttonColor }]}
              onPress={() => removeQueueItem(item.id)}
            >
              <ThemedText style={{ color: buttonTextColor }}>Eliminar</ThemedText>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<ThemedText>No hay operaciones en la cola</ThemedText>}
      />
      <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={processQueue}>
        <ThemedText style={{ color: buttonTextColor }}>Reintentar</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={clearQueue}>
        <ThemedText style={{ color: buttonTextColor }}>Borrar cola</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={clearDatabases}>
        <ThemedText style={{ color: buttonTextColor }}>Borrar bases de datos</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  item: { paddingVertical: 8, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  button: { marginTop: 16, padding: 12, borderRadius: 8, alignItems: 'center' },
  deleteButton: { padding: 6, borderRadius: 4 },
});
