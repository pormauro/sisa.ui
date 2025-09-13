// /app/clients/index.tsx
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ClientsListPage() {
  const { clients, loadClients, deleteClient } = useContext(ClientsContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');

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
            await deleteClient(id);
          },
        },
      ]
    );
  };
  const renderItem = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/clients/viewModal?id=${item.id}`)}
      onLongPress={() => router.push(`/clients/${item.id}`)}
    >
      <CircleImagePicker fileId={item.brand_file_id} size={50} />
      <View style={styles.itemInfo}>
        <ThemedText style={styles.itemTitle}>{item.business_name}</ThemedText>
        <ThemedText>{item.email}</ThemedText>
      </View>
      {canDeleteClient && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          <ThemedText style={styles.deleteText}>🗑️</ThemedText>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        placeholder="Buscar cliente..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[styles.searchInput, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<ThemedText style={styles.emptyText}>No se encontraron clientes</ThemedText>}
      />
      {canAddClient && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/clients/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Cliente</ThemedText>
        </TouchableOpacity>
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchInput: {
    borderWidth: 1,
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
  },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
