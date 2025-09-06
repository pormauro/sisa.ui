// /app/clients/index.tsx
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function ClientsListPage() {
  const { clients, loadClients, deleteClient } = useContext(ClientsContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const { permissions, loading: permissionsLoading } = useContext(PermissionsContext);

  // Ejemplo de chequeo de permisos:
  const canAddClient = permissions.includes('addClient');
  const canDeleteClient = permissions.includes('deleteClient');

  useEffect(() => {
    loadClients();
  }, []);

  // Configuración de Fuse para búsqueda en business_name, tax_id, email y address
  const fuse = new Fuse(clients, {
    keys: ['business_name', 'tax_id', 'email', 'address']
  });
  
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [searchQuery, clients]);

  const handleDelete = (id: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            await deleteClient(id);
            setLoadingId(null);
          },
        },
      ]
    );
  };
  const renderItem = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => router.push(`/clients/viewModal?id=${item.id}`)}
      onLongPress={() => router.push(`/clients/${item.id}`)}
    >
      <CircleImagePicker fileId={item.brand_file_id} size={50} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.business_name}</Text>
        <Text>{item.email}</Text>
      </View>
      {canDeleteClient && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? <ActivityIndicator /> : <Text style={styles.deleteText}>🗑️</Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar cliente..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
      />
      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron clientes</Text>}
      />
      {canAddClient && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/clients/create')}>
          <Text style={styles.addButtonText}>➕ Agregar Cliente</Text>
        </TouchableOpacity>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    backgroundColor: '#007BFF',
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
