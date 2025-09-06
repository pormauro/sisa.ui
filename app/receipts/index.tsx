// app/receipts/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import DetailModal from './DetailModal';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { ReceiptsContext, Receipt } from '@/contexts/ReceiptsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';

export default function ReceiptsScreen() {
  const { receipts, loadReceipts, deleteReceipt } = useContext(ReceiptsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (!permissions.includes('listReceipts')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver recibos.');
      router.back();
    } else {
      loadReceipts();
    }
  }, [permissions]);

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
        style={styles.item}
        onPress={() => setSelectedReceipt(item)}
        onLongPress={() => router.push(`/receipts/${item.id}`)}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.name}>{title}</Text>
          <Text>{item.description || 'Sin descripción'}</Text>
          <Text>Total: ${total}</Text>
        </View>
        {canDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
          >
            {loadingId === item.id ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.deleteText}>🗑️</Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Buscar recibo..."
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredReceipts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No se encontraron recibos</Text>}
      />
      {canAdd && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/receipts/create')}>
          <Text style={styles.addText}>➕ Agregar Recibo</Text>
        </TouchableOpacity>
      )}
      <DetailModal
        visible={selectedReceipt !== null}
        item={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  search: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  itemInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: { position: 'absolute', right: 16, bottom: 32, backgroundColor: '#007BFF', padding: 16, borderRadius: 50, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
