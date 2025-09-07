// app/statuses/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusesContext } from '@/contexts/StatusesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import Fuse from 'fuse.js';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function StatusesScreen() {
  const { statuses, loadStatuses, deleteStatus } = useContext(StatusesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!permissions.includes('listStatuses')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver los estados.');
      router.back();
    } else {
      loadStatuses();
    }
  }, [permissions]);

  const fuse = new Fuse(statuses, { keys: ['label', 'value'] });
  const filteredStatuses = useMemo(() => {
    if (!search) return statuses;
    const result = fuse.search(search);
    return result.map(r => r.item);
  }, [search, statuses]);

  const canDelete = permissions.includes('deleteStatus');

  const handleDelete = (id: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de eliminar este estado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            const success = await deleteStatus(id);
            setLoadingId(null);
            if (!success) {
              Alert.alert('Error', 'No se pudo eliminar el estado.');
            }
          }
        }
      ]
    );
  };

  const secondaryTextColor = useThemeColor({ light: '#555', dark: '#ccc' }, 'text');

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/statuses/viewModal?id=${item.id}`)}
      onLongPress={() => router.push(`/statuses/${item.id}`)}
    >
      <View style={[styles.colorBox, { backgroundColor: item.background_color }]} />
      <View style={styles.itemContent}>
        <ThemedText style={styles.itemLabel}>{item.label}</ThemedText>
        <ThemedText style={[styles.itemValue, { color: secondaryTextColor }]}>{item.value}</ThemedText>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? (
            <ActivityIndicator color={spinnerColor} />
          ) : (
            <ThemedText style={styles.deleteButtonText}>Eliminar</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        style={[
          styles.searchInput,
          { backgroundColor: inputBackground, color: inputTextColor, borderColor },
        ]}
        placeholder="Buscar estados..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredStatuses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron estados</ThemedText>
        }
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/statuses/create')}
      >
        <ThemedText style={styles.addButtonText}>Agregar Estado</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  colorBox: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemValue: {
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
  },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
  },
});
