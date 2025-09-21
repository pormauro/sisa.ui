// app/receipts/index.tsx
import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import { ReceiptsContext, Receipt } from '@/contexts/ReceiptsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ReceiptsScreen() {
  const { receipts, loadReceipts, deleteReceipt } = useContext(ReceiptsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
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
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');

  useEffect(() => {
    if (!permissions.includes('listReceipts')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver recibos.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (!permissions.includes('listReceipts')) {
        return;
      }
      void loadReceipts();
    }, [permissions, loadReceipts])
  );

  const fuse = new Fuse(receipts, { keys: ['description'] });
  const filteredReceipts = useMemo(() => {
    if (!search) return receipts;
    const result = fuse.search(search);
    return result.map(r => r.item);
  }, [search, receipts]);

  const canDelete = permissions.includes('deleteReceipt');
  const canAdd = permissions.includes('addReceipt');

  const handleDelete = (id: number) => {
    Alert.alert('Confirmar eliminación', '¿Eliminar este recibo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoadingId(id);
          await deleteReceipt(id);
          setLoadingId(null);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Receipt }) => {
    const total = item.price;
    let title = '';
    if (item.payer_type === 'client') {
      const client = clients.find(c => c.id === item.payer_client_id);
      title = client?.business_name || 'Sin cliente';
    } else if (item.payer_type === 'provider') {
      const provider = providers.find(p => p.id === item.payer_provider_id);
      title = provider?.business_name || 'Sin proveedor';
    } else {
      title = item.payer_other || 'Sin pagador';
    }
    return (
      <TouchableOpacity
        style={[styles.item, { borderColor: itemBorderColor }]}
        onPress={() => router.push(`/receipts/viewModal?id=${item.id}`)}
        onLongPress={() => router.push(`/receipts/${item.id}`)}
      >
        <View style={styles.itemInfo}>
          <ThemedText style={styles.name}>{title}</ThemedText>
          <ThemedText>{item.description || 'Sin descripción'}</ThemedText>
          <ThemedText>Total: ${total}</ThemedText>
        </View>
        {canDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
          >
            {loadingId === item.id ? (
              <ActivityIndicator color={spinnerColor} />
            ) : (
              <ThemedText style={styles.deleteText}>🗑️</ThemedText>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        style={[styles.search, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Buscar recibo..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredReceipts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: canAdd ? 120 : 0 }} />}
        ListEmptyComponent={<ThemedText style={styles.empty}>No se encontraron recibos</ThemedText>}
      />
      {canAdd && (
        <TouchableOpacity style={[styles.addButton, { backgroundColor: addButtonColor }]} onPress={() => router.push('/receipts/create')}>
          <ThemedText style={[styles.addText, { color: addButtonTextColor }]}>➕ Agregar Recibo</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  search: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: { position: 'absolute', right: 16, bottom: 32, padding: 16, borderRadius: 50, alignItems: 'center' },
  addText: { fontSize: 16, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 16 },
  listContent: { paddingBottom: 16 },
});
