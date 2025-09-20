// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/CashBoxesScreen.tsx
import React, { useContext, useState, useMemo, useEffect } from 'react';
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
import CircleImagePicker from '@/components/CircleImagePicker';
import { CashBoxesContext, CashBox } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CashBoxesScreen() {
  const { cashBoxes, loadCashBoxes, deleteCashBox } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
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
      style={[styles.itemContainer, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`./cash_boxes/${item.id}`)}
      onLongPress={() => router.push(`./cash_boxes/${item.id}`)}
    >
      <CircleImagePicker fileId={item.image_file_id} size={50} />
      <View style={styles.itemInfo}>
        <ThemedText style={styles.itemTitle}>{item.name}</ThemedText>
      </View>
      {canDeleteCashBox && (
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? (
            <ActivityIndicator color={spinnerColor} />
          ) : (
            <ThemedText style={styles.deleteText}>🗑</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}> 
      <TextInput
        placeholder="Buscar caja..."
        style={[
          styles.searchInput,
          { backgroundColor: inputBackground, color: inputTextColor, borderColor },
        ]}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredCashBoxes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron cajas</ThemedText>
        }
      />
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: addButtonColor }]}
        onPress={() => router.push('/cash_boxes/create')}
      >
        <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Caja</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchInput: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { padding: 8 },
  deleteText: { fontSize: 18 },
  addButton: { position: 'absolute', right: 16, bottom: 32, padding: 16, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
