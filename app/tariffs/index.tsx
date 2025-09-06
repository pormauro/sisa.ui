// app/tariffs/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import ItemDetailModal from '@/components/ItemDetailModal';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { TariffsContext, Tariff } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function TariffsScreen() {
  const { tariffs, loadTariffs, deleteTariff } = useContext(TariffsContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);

  useEffect(() => {
    if (!permissions.includes('listTariffs')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver tarifas.');
      router.back();
    } else {
      loadTariffs();
    }
  }, [permissions]);

  const fuse = new Fuse(tariffs, { keys: ['name'] });
  const filteredTariffs = useMemo(() => {
    if (!search) return tariffs;
    const result = fuse.search(search);
    return result.map(r => r.item);
  }, [search, tariffs]);

  const canDelete = permissions.includes('deleteTariff');
  const canAdd = permissions.includes('addTariff');

  const handleDelete = (id: number) => {
    Alert.alert('Confirmar eliminación', '¿Deseas eliminar esta tarifa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoadingId(id);
          const success = await deleteTariff(id);
          setLoadingId(null);
          if (!success) {
            Alert.alert('Error', 'No se pudo eliminar la tarifa.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Tariff }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => setSelectedTariff(item)}
      onLongPress={() => router.push(`/tariffs/${item.id}`)}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text>${item.amount}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? <ActivityIndicator /> : <Text style={styles.deleteText}>🗑️</Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Buscar tarifa..."
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredTariffs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No se encontraron tarifas</Text>}
      />
      {canAdd && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/tariffs/create')}>
          <Text style={styles.addText}>➕ Agregar Tarifa</Text>
        </TouchableOpacity>
      )}
      <ItemDetailModal
        visible={selectedTariff !== null}
        item={selectedTariff}
        onClose={() => setSelectedTariff(null)}
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
