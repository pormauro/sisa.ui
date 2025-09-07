// app/payments/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { PaymentsContext, Payment } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function PaymentsScreen() {
  const { payments, loadPayments, deletePayment } = useContext(PaymentsContext);
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
        style={[styles.item, { borderColor: itemBorderColor }]}
        onPress={() => router.push(`/payments/viewModal?id=${item.id}`)}
        onLongPress={() => router.push(`/payments/${item.id}`)}
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
        placeholder="Buscar pago..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<ThemedText style={styles.empty}>No se encontraron pagos</ThemedText>}
      />
      {canAdd && (
        <TouchableOpacity style={[styles.addButton, { backgroundColor: addButtonColor }]} onPress={() => router.push('/payments/create')}>
          <ThemedText style={[styles.addText, { color: addButtonTextColor }]}>➕ Agregar Pago</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  search: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: { position: 'absolute', right: 16, bottom: 32, padding: 16, borderRadius: 50, alignItems: 'center' },
  addText: { fontSize: 16, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
