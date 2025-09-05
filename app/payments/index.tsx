// app/payments/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { PaymentsContext, Payment } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';

export default function PaymentsScreen() {
  const { payments, loadPayments, deletePayment } = useContext(PaymentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!permissions.includes('listPayments')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver pagos.');
      router.back();
    } else {
      loadPayments();
    }
  }, [permissions]);

  const fuse = new Fuse(payments, { keys: ['description'] });
  const filteredPayments = useMemo(() => {
    if (!search) return payments;
    const result = fuse.search(search);
    return result.map(r => r.item);
  }, [search, payments]);

  const canDelete = permissions.includes('deletePayment');
  const canAdd = permissions.includes('addPayment');

  const handleDelete = (id: number) => {
    Alert.alert('Confirmar eliminación', '¿Eliminar este pago?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoadingId(id);
          await deletePayment(id);
          setLoadingId(null);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Payment }) => {
    const total = item.price;
    const client = clients.find(
      c => c.id === item.creditor_client_id || c.id === item.client_id
    );
    return (
      <TouchableOpacity
        style={styles.item}
        onLongPress={() => router.push(`/payments/${item.id}`)}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.name}>{client?.business_name || 'Sin cliente'}</Text>
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
        placeholder="Buscar pago..."
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No se encontraron pagos</Text>}
      />
      {canAdd && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/payments/create')}>
          <Text style={styles.addText}>➕ Agregar Pago</Text>
        </TouchableOpacity>
      )}
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
