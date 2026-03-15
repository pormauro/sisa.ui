import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Fuse from 'fuse.js';

import { AccountsContext, Account } from '@/contexts/AccountsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function AccountsScreen() {
  const router = useRouter();
  const { accounts, loadAccounts } = useContext(AccountsContext);
  const { permissions } = useContext(PermissionsContext);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

  const canList = permissions.includes('listAccounts');
  const canCreate = permissions.includes('addAccount');

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tenes permiso para ver cuentas contables.');
      router.back();
    }
  }, [canList, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) return;
      void loadAccounts(statusFilter);
    }, [canList, loadAccounts, statusFilter]),
  );

  const filtered = useMemo(() => {
    const items = statusFilter === 'all' ? accounts : accounts.filter(item => item.status === statusFilter);
    if (!search.trim()) return items;
    const fuse = new Fuse(items, { keys: ['name', 'code', 'description'] });
    return fuse.search(search.trim()).map(result => result.item);
  }, [accounts, search, statusFilter]);

  const renderItem = ({ item }: { item: Account }) => (
    <TouchableOpacity style={[styles.card, { borderColor }]} onPress={() => router.push(`/accounts/${item.id}`)}>
      <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
      <ThemedText style={{ color: secondaryText }}>{item.code || 'Sin codigo'} · {item.type}</ThemedText>
      <ThemedText>Saldo actual: {formatMoney(item.current_balance)}</ThemedText>
      <ThemedText>Saldo inicial: {formatMoney(item.opening_balance)}</ThemedText>
      <ThemedText>Estado: {item.status}</ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar cuenta..."
        placeholderTextColor={secondaryText}
      />
      <SearchableSelect
        style={styles.select}
        items={[
          { label: 'Activas', value: 'active' },
          { label: 'Archivadas', value: 'archived' },
          { label: 'Todas', value: 'all' },
        ]}
        selectedValue={statusFilter}
        onValueChange={value => setStatusFilter((value?.toString() as 'active' | 'archived' | 'all') || 'active')}
        showSearch={false}
        placeholder="Estado"
      />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ThemedText style={{ color: secondaryText }}>No hay cuentas contables para mostrar.</ThemedText>}
      />
      {canCreate ? (
        <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={() => router.push('/accounts/create')}>
          <ThemedText style={{ color: buttonTextColor }}>Crear cuenta</ThemedText>
        </TouchableOpacity>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  select: { marginBottom: 12 },
  list: { paddingBottom: 100, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
});
