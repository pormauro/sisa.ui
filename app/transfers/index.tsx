import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Fuse from 'fuse.js';

import { TransfersContext, TransferRecord } from '@/contexts/TransfersContext';
import { AccountsContext } from '@/contexts/AccountsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function TransfersScreen() {
  const router = useRouter();
  const { transfers, loadTransfers } = useContext(TransfersContext);
  const { accounts, loadAccounts } = useContext(AccountsContext);
  const { permissions } = useContext(PermissionsContext);
  const [search, setSearch] = useState('');

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

  const canView = permissions.includes('listAccountingEntries') || permissions.includes('addTransfer');
  const canCreate = permissions.includes('addTransfer');

  useEffect(() => {
    if (!canView) {
      Alert.alert('Acceso denegado', 'No tenes permiso para ver transferencias.');
      router.back();
    }
  }, [canView, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canView) return;
      void loadTransfers();
      void loadAccounts('all');
    }, [canView, loadAccounts, loadTransfers]),
  );

  const accountName = useCallback((id: number) => accounts.find(item => item.id === id)?.name || `Cuenta ${id}`, [accounts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return transfers;
    const items = transfers.map(item => ({
      ...item,
      origin_name: accountName(item.origin_account_id),
      destination_name: accountName(item.destination_account_id),
    }));
    const fuse = new Fuse(items, { keys: ['description', 'origin_name', 'destination_name'] });
    return fuse.search(search.trim()).map(result => result.item);
  }, [accountName, search, transfers]);

  const renderItem = ({ item }: { item: TransferRecord }) => (
    <TouchableOpacity style={[styles.card, { borderColor }]} onPress={() => router.push(`/transfers/${item.id}`)}>
      <ThemedText style={styles.title}>{`${accountName(item.origin_account_id)} -> ${accountName(item.destination_account_id)}`}</ThemedText>
      <ThemedText>Monto: {formatMoney(item.amount)}</ThemedText>
      <ThemedText>Fecha: {item.transfer_date || 'Sin fecha'}</ThemedText>
      <ThemedText style={{ color: secondaryText }}>{item.description || 'Sin descripcion'}</ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={search} onChangeText={setSearch} placeholder="Buscar transferencia..." placeholderTextColor={secondaryText} />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ThemedText style={{ color: secondaryText }}>No hay transferencias registradas.</ThemedText>}
      />
      {canCreate ? <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={() => router.push('/transfers/create')}><ThemedText style={{ color: buttonTextColor }}>Nueva transferencia</ThemedText></TouchableOpacity> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  list: { paddingBottom: 100 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
});
