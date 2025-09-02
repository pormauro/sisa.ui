// app/providers/index.tsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { ProvidersContext, Provider } from '@/contexts/ProvidersContext';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function ProvidersListPage() {
  const { providers, loadProviders, deleteProvider } = useContext(ProvidersContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const { permissions } = useContext(PermissionsContext);

  const canAdd = permissions.includes('addProvider');
  const canDelete = permissions.includes('deleteProvider');

  useEffect(() => {
    if (!permissions.includes('listProviders')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver proveedores.');
      router.back();
    } else {
      loadProviders();
    }
  }, [permissions, loadProviders, router]);

  const fuse = useMemo(
    () => new Fuse(providers, { keys: ['business_name', 'tax_id', 'email', 'address'] }),
    [providers]
  );
  const filteredProviders = useMemo(() => {
    if (!searchQuery) return providers;
    const results = fuse.search(searchQuery);
    return results.map(r => r.item);
  }, [searchQuery, providers, fuse]);

  const handleDelete = (id: number) => {
    Alert.alert('Confirmar eliminación', '¿Eliminar este proveedor?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoadingId(id);
          await deleteProvider(id);
          setLoadingId(null);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Provider }) => (
    <TouchableOpacity style={styles.itemContainer} onLongPress={() => router.push(`./providers/${item.id}`)}>
      <CircleImagePicker fileId={item.brand_file_id} size={50} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.business_name}</Text>
        <Text>{item.email || ''}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? <ActivityIndicator /> : <Text style={styles.deleteText}>🗑️</Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar proveedor..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
      />
      <FlatList
        data={filteredProviders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron proveedores</Text>}
      />
      {canAdd && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/providers/create')}>
          <Text style={styles.addButtonText}>➕ Agregar Proveedor</Text>
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
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
