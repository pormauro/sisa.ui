// app/payments/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import ItemDetailModal from '@/components/ItemDetailModal';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { PaymentsContext, Payment } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';

export default function PaymentsScreen() {
  const { payments, loadPayments, deletePayment } = useContext(PaymentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

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
    let title = '';
    if (item.creditor_type === 'client') {
      const client = clients.find(c => c.id === item.creditor_client_id);
      title = client?.business_name || 'Sin cliente';
    } else if (item.creditor_type === 'provider') {
      const provider = providers.find(p => p.id === item.creditor_provider_id);
      title = provider?.business_name || 'Sin proveedor';
    } else {
      title = item.creditor_other || 'Sin acreedor';
    }
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => setSelectedPayment(item)}
        onLongPress={() => router.push(`/payments/${item.id}`)}
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
      <ItemDetailModal
        visible={selectedPayment !== null}
        item={selectedPayment}
        fieldLabels={{
          id: 'ID',
          payment_date: 'Fecha',
          paid_with_account: 'Pagado con cuenta',
          creditor_type: 'Tipo acreedor',
          creditor_client_id: 'Cliente acreedor',
          creditor_provider_id: 'Proveedor acreedor',
          creditor_other: 'Otro acreedor',
          description: 'Descripción',
          category_id: 'Categoría',
          price: 'Precio',
          charge_client: 'Cobrar al cliente',
          client_id: 'Cliente',
          created_at: 'Fecha de creación',
          updated_at: 'Fecha de edición',
        }}
        onClose={() => setSelectedPayment(null)}
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
