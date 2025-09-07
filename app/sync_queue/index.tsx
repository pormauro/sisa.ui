import React, { useContext } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function SyncQueuePage() {
  const { queue, processQueue } = useContext(ClientsContext);
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
            <ThemedText>{item.table_name} - {item.op}</ThemedText>
            <ThemedText>{item.status}</ThemedText>
          </View>
        )}
        ListEmptyComponent={<ThemedText>No hay operaciones en la cola</ThemedText>}
      />
      <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={processQueue}>
        <ThemedText style={{ color: buttonTextColor }}>Reintentar</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  item: { paddingVertical: 8, borderBottomWidth: 1 },
  button: { marginTop: 16, padding: 12, borderRadius: 8, alignItems: 'center' },
});
