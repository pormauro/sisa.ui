// app/providers/index.tsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { ProvidersContext, Provider } from '@/contexts/ProvidersContext';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ProvidersListPage() {
  const { providers, loadProviders, deleteProvider } = useContext(ProvidersContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const spinnerColor = useThemeColor({}, 'tint');

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
    <TouchableOpacity
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/providers/viewModal?id=${item.id}`)}
      onLongPress={() => router.push(`./providers/${item.id}`)}
    >
      <CircleImagePicker fileId={item.brand_file_id} size={50} />
      <View style={styles.itemInfo}>
        <ThemedText style={styles.itemTitle}>{item.business_name}</ThemedText>
        <ThemedText>{item.email || ''}</ThemedText>
      </View>
      {item.syncStatus === 'pending' && <ActivityIndicator color={spinnerColor} />}
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? (
            <ActivityIndicator color={spinnerColor} />
          ) : (
            <ThemedText style={styles.deleteText}>🗑️</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        placeholder="Buscar proveedor..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[styles.searchInput, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredProviders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<ThemedText style={styles.emptyText}>No se encontraron proveedores</ThemedText>}
      />
      {canAdd && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/providers/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕</ThemedText>
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
    padding: 20,
    borderRadius: 50,
  },
  addButtonText: { fontSize: 24, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
