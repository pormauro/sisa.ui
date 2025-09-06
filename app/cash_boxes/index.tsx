// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/CashBoxesScreen.tsx
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import ItemDetailModal from '@/components/ItemDetailModal';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { CashBoxesContext, CashBox } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CashBoxesScreen() {
  const { cashBoxes, loadCashBoxes, deleteCashBox } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [selectedCashBox, setSelectedCashBox] = useState<CashBox | null>(null);

  useEffect(() => {
    // Verificamos el permiso para listar cajas
    if (!permissions.includes('listCashBoxes')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver las cajas.');
      router.back();
    } else {
      loadCashBoxes();
    }
  }, [permissions]);

  const fuse = new Fuse(cashBoxes, { keys: ['name'] });
  const filteredCashBoxes = useMemo(() => {
    if (!searchQuery) return cashBoxes;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [searchQuery, cashBoxes]);

  const canDeleteCashBox = permissions.includes('deleteCashBox');

  const handleDelete = (id: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Está seguro de que desea eliminar esta caja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            const success = await deleteCashBox(id);
            setLoadingId(null);
            if (!success) {
              Alert.alert('Error', 'No se pudo eliminar la caja');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: CashBox }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => setSelectedCashBox(item)}
      onLongPress={() => router.push(`./cash_boxes/${item.id}`)}
    >
      <CircleImagePicker fileId={item.image_file_id} size={50} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.name}</Text>
      </View>
      {canDeleteCashBox && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? <ActivityIndicator /> : <Text style={styles.deleteText}>🗑</Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput 
        placeholder="Buscar caja..."
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <FlatList
        data={filteredCashBoxes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron cajas</Text>}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/cash_boxes/create')}>
        <Text style={styles.addButtonText}>➕ Agregar Caja</Text>
      </TouchableOpacity>
      <ItemDetailModal
        visible={selectedCashBox !== null}
        item={selectedCashBox}
        onClose={() => setSelectedCashBox(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  searchInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: { position: 'absolute', right: 16, bottom: 32, backgroundColor: '#007BFF', padding: 16, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
