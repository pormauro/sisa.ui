import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { AccountsContext } from '@/contexts/AccountsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function AccountDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const { accounts, loadAccounts } = useContext(AccountsContext);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const canList = permissions.includes('listAccounts');
  const canEdit = permissions.includes('addAccount');
  const account = useMemo(() => accounts.find(item => item.id === accountId), [accountId, accounts]);

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tenes permiso para ver esta cuenta.');
      router.back();
    }
  }, [canList, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) return;
      void loadAccounts('all');
    }, [canList, loadAccounts]),
  );

  if (!Number.isFinite(accountId) || accountId <= 0 || !account) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Cuenta no encontrada.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { borderColor }]}>
          <ThemedText style={styles.title}>{account.name}</ThemedText>
          <ThemedText>Codigo: {account.code || 'Sin codigo'}</ThemedText>
          <ThemedText>Tipo: {account.type}</ThemedText>
          <ThemedText>Estado: {account.status}</ThemedText>
          <ThemedText>Saldo inicial: {formatMoney(account.opening_balance)}</ThemedText>
          <ThemedText>Saldo actual: {formatMoney(account.current_balance)}</ThemedText>
          <ThemedText>Empresa: {account.company_id ?? 'Sin empresa'}</ThemedText>
          <ThemedText>Descripcion: {account.description || 'Sin descripcion'}</ThemedText>
        </View>
        <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={() => router.push(`/journal_entries?account_id=${account.id}`)}>
          <ThemedText style={{ color: buttonTextColor }}>Ver libro diario</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={() => router.push(`/transfers/create?origin_account_id=${account.id}`)}>
          <ThemedText style={{ color: buttonTextColor }}>Nueva transferencia</ThemedText>
        </TouchableOpacity>
        {canEdit ? (
          <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={() => router.push(`/accounts/edit?id=${account.id}`)}>
            <ThemedText style={{ color: buttonTextColor }}>Editar cuenta</ThemedText>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: FORM_BOTTOM_SPACING, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  title: { fontSize: 20, fontWeight: '700' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
});
