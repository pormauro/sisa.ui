// app/statuses/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import ItemDetailModal from '@/components/ItemDetailModal';
import { useRouter } from 'expo-router';
import { StatusesContext } from '@/contexts/StatusesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import Fuse from 'fuse.js';
import { Alert as RNAlert } from 'react-native';

export default function StatusesScreen() {
  const { statuses, loadStatuses, deleteStatus } = useContext(StatusesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<any | null>(null);

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

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => setSelectedStatus(item)}
      onLongPress={() => router.push(`/statuses/${item.id}`)}
    >
      <View style={[styles.colorBox, { backgroundColor: item.background_color }]} />
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        <Text style={styles.itemValue}>{item.value}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Eliminar</Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar estados..."
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredStatuses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron estados</Text>}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/statuses/create')}>
        <Text style={styles.addButtonText}>Agregar Estado</Text>
      </TouchableOpacity>
      <ItemDetailModal
        visible={selectedStatus !== null}
        item={selectedStatus}
        fieldLabels={{
          id: 'ID',
          label: 'Etiqueta',
          value: 'Valor',
          background_color: 'Color de fondo',
          order_index: 'Orden',
          created_at: 'Fecha de creación',
          updated_at: 'Fecha de edición',
        }}
        onClose={() => setSelectedStatus(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
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
    color: '#555',
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
    backgroundColor: '#007BFF',
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
  },
});
