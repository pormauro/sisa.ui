import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { AccountingEntriesContext } from '@/contexts/AccountingEntriesContext';
import { AccountsContext } from '@/contexts/AccountsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function JournalEntriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ account_id?: string }>();
  const { entries, lastResult, loadEntries } = useContext(AccountingEntriesContext);
  const { accounts, loadAccounts } = useContext(AccountsContext);
  const { permissions } = useContext(PermissionsContext);

  const [accountId, setAccountId] = useState(params.account_id?.toString() ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryType, setEntryType] = useState('');

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

  const canList = permissions.includes('listAccountingEntries');

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tenes permiso para ver asientos contables.');
      router.back();
    }
  }, [canList, router]);

  const runSearch = useCallback(() => {
    if (!canList) return;
    void loadEntries({
      account_id: accountId ? Number(accountId) : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      entry_type: entryType === 'debit' || entryType === 'credit' ? entryType : undefined,
      per_page: 200,
      sort_by: 'entry_date',
      sort_direction: 'desc',
    });
  }, [accountId, canList, endDate, entryType, loadEntries, startDate]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) return;
      void loadAccounts('all');
      runSearch();
    }, [canList, loadAccounts, runSearch]),
  );

  const accountItems = useMemo(
    () => [{ label: 'Todas las cuentas', value: '' }, ...accounts.map(item => ({ label: item.name, value: item.id.toString() }))],
    [accounts],
  );

  const accountName = useCallback((id: number) => accounts.find(item => item.id === id)?.name || `Cuenta ${id}`, [accounts]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={startDate} onChangeText={setStartDate} placeholder="Desde (AAAA-MM-DD)" placeholderTextColor={secondaryText} />
      <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={endDate} onChangeText={setEndDate} placeholder="Hasta (AAAA-MM-DD)" placeholderTextColor={secondaryText} />
      <SearchableSelect style={styles.select} items={accountItems} selectedValue={accountId} onValueChange={value => setAccountId(value?.toString() ?? '')} placeholder="Cuenta" />
      <SearchableSelect style={styles.select} items={[{ label: 'Todos', value: '' }, { label: 'Debito', value: 'debit' }, { label: 'Credito', value: 'credit' }]} selectedValue={entryType} onValueChange={value => setEntryType(value?.toString() ?? '')} showSearch={false} placeholder="Tipo" />
      <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={runSearch}><ThemedText style={{ color: buttonTextColor }}>Aplicar filtros</ThemedText></TouchableOpacity>
      <View style={[styles.summaryCard, { borderColor }]}>
        <ThemedText>Debitos: {formatMoney(lastResult?.totals.debit)}</ThemedText>
        <ThemedText>Creditos: {formatMoney(lastResult?.totals.credit)}</ThemedText>
        <ThemedText>Neto: {formatMoney(lastResult?.totals.net)}</ThemedText>
      </View>
      <FlatList
        data={entries}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, { borderColor }]} onPress={() => router.push(`/journal_entries/${item.id}`)}>
            <ThemedText style={styles.cardTitle}>{accountName(item.account_id)}</ThemedText>
            <ThemedText>{item.entry_type === 'debit' ? 'Debito' : 'Credito'} - {formatMoney(item.amount)}</ThemedText>
            <ThemedText>{item.entry_date}</ThemedText>
            <ThemedText style={{ color: secondaryText }}>{item.description || item.origin_type || 'Sin descripcion'}</ThemedText>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  select: { marginBottom: 12 },
  button: { padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  summaryCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4, marginBottom: 12 },
  list: { paddingBottom: 100 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
});
