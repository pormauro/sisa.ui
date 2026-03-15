import React, { useContext, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AccountingEntriesContext } from '@/contexts/AccountingEntriesContext';
import { AccountsContext } from '@/contexts/AccountsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function JournalEntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Number(id);
  const { entries } = useContext(AccountingEntriesContext);
  const { accounts } = useContext(AccountsContext);
  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');

  const entry = useMemo(() => entries.find(item => item.id === entryId), [entries, entryId]);
  const accountName = entry ? accounts.find(item => item.id === entry.account_id)?.name || `Cuenta ${entry.account_id}` : '';

  if (!entry) {
    return <ThemedView style={[styles.container, { backgroundColor: background }]}><ThemedText>Asiento no encontrado.</ThemedText></ThemedView>;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={[styles.card, { borderColor }]}>
        <ThemedText style={styles.title}>Asiento #{entry.id}</ThemedText>
        <ThemedText>Cuenta: {accountName}</ThemedText>
        <ThemedText>Tipo: {entry.entry_type}</ThemedText>
        <ThemedText>Monto: {formatMoney(entry.amount)}</ThemedText>
        <ThemedText>Fecha: {entry.entry_date}</ThemedText>
        <ThemedText>Origen: {entry.origin_type || 'Manual'} #{entry.origin_id ?? '-'}</ThemedText>
        <ThemedText>Empresa: {entry.company_id ?? '-'}</ThemedText>
        <ThemedText>Descripcion: {entry.description || 'Sin descripcion'}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  title: { fontSize: 18, fontWeight: '700' },
});
