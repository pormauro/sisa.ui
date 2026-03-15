import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { AccountsContext } from '@/contexts/AccountsContext';
import { TransfersContext } from '@/contexts/TransfersContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function TransferDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const transferId = Number(id);
  const { transfers, loadTransfers, getTransferEntries } = useContext(TransfersContext);
  const { accounts, loadAccounts } = useContext(AccountsContext);
  const { permissions } = useContext(PermissionsContext);
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');

  const canView = permissions.includes('listAccountingEntries') || permissions.includes('addTransfer');
  const transfer = useMemo(() => transfers.find(item => item.id === transferId), [transferId, transfers]);
  const accountName = useCallback((accountId: number) => accounts.find(item => item.id === accountId)?.name || `Cuenta ${accountId}`, [accounts]);

  useEffect(() => {
    if (!canView) {
      Alert.alert('Acceso denegado', 'No tenes permiso para ver esta transferencia.');
      router.back();
    }
  }, [canView, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canView || !Number.isFinite(transferId) || transferId <= 0) return;
      void loadTransfers();
      void loadAccounts('all');
      void getTransferEntries(transferId).then(setEntries);
    }, [canView, getTransferEntries, loadAccounts, loadTransfers, transferId]),
  );

  if (!Number.isFinite(transferId) || transferId <= 0 || !transfer) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Transferencia no encontrada.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { borderColor }]}> 
          <ThemedText style={styles.title}>{`${accountName(transfer.origin_account_id)} -> ${accountName(transfer.destination_account_id)}`}</ThemedText>
          <ThemedText>Monto: {formatMoney(transfer.amount)}</ThemedText>
          <ThemedText>Fecha: {transfer.transfer_date || 'Sin fecha'}</ThemedText>
          <ThemedText>Descripcion: {transfer.description || 'Sin descripcion'}</ThemedText>
          <ThemedText>Empresa: {transfer.company_id ?? '-'}</ThemedText>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.linkButton, { borderColor }]} onPress={() => router.push(`/accounts/${transfer.origin_account_id}`)}>
              <ThemedText>Cuenta origen</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkButton, { borderColor }]} onPress={() => router.push(`/accounts/${transfer.destination_account_id}`)}>
              <ThemedText>Cuenta destino</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.card, { borderColor }]}>
          <ThemedText style={styles.title}>Asientos generados</ThemedText>
          {entries.map(entry => (
            <View key={String(entry.id)} style={styles.entryRow}>
              <ThemedText>{String(entry.entry_type || '').toUpperCase()} - {accountName(Number(entry.account_id))}</ThemedText>
              <ThemedText>{formatMoney(Number(entry.amount || 0))}</ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: FORM_BOTTOM_SPACING, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  entryRow: { gap: 2, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#99999933' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
});
