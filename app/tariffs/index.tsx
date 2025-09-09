// app/tariffs/index.tsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  FlatList,
  TouchableOpacity,
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { TariffsContext, Tariff } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function TariffsScreen() {
  const { tariffs, loadTariffs, deleteTariff } = useContext(TariffsContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!permissions.includes('listTariffs')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver tarifas.');
      router.back();
    } else {
      loadTariffs();
    }
  }, [permissions, loadTariffs, router]);

  const filteredTariffs = useMemo(() => {
    if (!search) return tariffs;
    const fuse = new Fuse(tariffs, { keys: ['name'] });
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

  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const renderItem = ({ item }: { item: Tariff }) => (
    <TouchableOpacity
      style={[styles.item, { borderColor: itemBorderColor }]}
      onPress={() => router.push(`/tariffs/viewModal?id=${item.id}`)}
      onLongPress={() => router.push(`/tariffs/${item.id}`)}
    >
      <View style={styles.itemInfo}>
        <ThemedText style={styles.name}>{item.name}</ThemedText>
        <ThemedText>${item.amount}</ThemedText>
      </View>
      {item.syncStatus === 'pending' && <ActivityIndicator color={textColor} />}
      {canDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          {loadingId === item.id ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <ThemedText style={styles.deleteText}>🗑️</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <TextInput
        style={[
          styles.search,
          { borderColor, backgroundColor: inputBackground, color: textColor },
        ]}
        placeholder="Buscar tarifa..."
        placeholderTextColor={placeholderColor}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredTariffs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>No se encontraron tarifas</ThemedText>
        }
      />
      {canAdd && (
        <ThemedButton
          title="➕"
          onPress={() => router.push('/tariffs/create')}
          style={styles.addButton}
          textStyle={{ color: buttonTextColor, fontSize: 24, fontWeight: 'bold' }}
        />
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
  addButton: { position: 'absolute', right: 16, bottom: 32, borderRadius: 50, padding: 20 },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
