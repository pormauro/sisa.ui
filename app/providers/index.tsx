// app/providers/index.tsx
import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { ProvidersContext, Provider } from '@/contexts/ProvidersContext';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ProvidersListPage() {
  const { providers, loadProviders, deleteProvider } = useContext(ProvidersContext);
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

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
  const canEdit = permissions.includes('updateProvider');

  useEffect(() => {
    if (!permissions.includes('listProviders')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver proveedores.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (!permissions.includes('listProviders')) {
        return;
      }
      void loadProviders();
    }, [permissions, loadProviders])
  );

  const fuse = useMemo(
    () =>
      new Fuse(providers, {
        keys: ['business_name', 'tax_id', 'email', 'address'],
      }),
    [providers]
  );

  const filteredProviders = useMemo(() => {
    if (!searchQuery) return providers;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [providers, fuse, searchQuery]);

  const handleDelete = useCallback(
    (id: number) => {
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
    },
    [deleteProvider]
  );

  const handleDeleteProvider = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      handleDelete(id);
    },
    [handleDelete]
  );

  const renderItem = ({ item }: { item: Provider }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/providers/viewModal?id=${item.id}`)}
      onLongPress={() => canEdit && router.push(`/providers/${item.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.itemContent}>
        <CircleImagePicker fileId={item.brand_file_id} size={50} />
        <View style={styles.itemInfo}>
          <ThemedText style={styles.itemTitle}>{item.business_name}</ThemedText>
          {item.address ? (
            <ThemedText style={styles.itemSubtitle}>{item.address}</ThemedText>
          ) : null}
          {item.email ? (
            <ThemedText style={styles.itemSubtitle}>{item.email}</ThemedText>
          ) : null}
        </View>
      </View>

      {canDelete && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(event) => handleDeleteProvider(event, item.id)}
          >
            {loadingId === item.id ? (
              <ActivityIndicator color={spinnerColor} />
            ) : (
              <ThemedText style={styles.actionText}>🗑️</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        placeholder="Buscar proveedor..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[
          styles.searchInput,
          { backgroundColor: inputBackground, color: inputTextColor, borderColor },
        ]}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredProviders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron proveedores</ThemedText>
        }
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: canAdd ? 120 : 0 }} />}
      />
      {canAdd && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/providers/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Proveedor</ThemedText>
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
  listContent: {
    paddingBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  itemSubtitle: { fontSize: 14, marginTop: 2 },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: { padding: 6, marginLeft: 4 },
  actionText: { fontSize: 18 },
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
