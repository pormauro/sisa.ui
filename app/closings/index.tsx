import React, { useCallback, useContext, useEffect } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ClosingsContext, AccountingClosing } from '@/contexts/ClosingsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function ClosingsScreen() {
  const router = useRouter();
  const { closings, loadClosings } = useContext(ClosingsContext);
  const { cashBoxes, loadCashBoxes } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const canList = permissions.includes('listClosings');
  const canCreate = permissions.includes('addClosing');

  useEffect(() => {
    if (!canList && !canCreate) {
      Alert.alert('Acceso denegado', 'No tenes permiso para ver cierres contables.');
      router.back();
    }
  }, [canCreate, canList, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canList && !canCreate) return;
      void loadClosings();
      void loadCashBoxes();
    }, [canCreate, canList, loadCashBoxes, loadClosings]),
  );

  const cashBoxName = (id: number) => cashBoxes.find(item => item.id === id)?.name || `Caja ${id}`;

  const renderItem = ({ item }: { item: AccountingClosing }) => (
    <TouchableOpacity style={[styles.card, { borderColor }]} onPress={() => router.push(`/closings/${item.id}`)}>
      <ThemedText style={styles.title}>{cashBoxName(item.cash_box_id)}</ThemedText>
      <ThemedText>Fecha: {item.closing_date}</ThemedText>
      <ThemedText>Ingresos: {formatMoney(item.total_income)}</ThemedText>
      <ThemedText>Egresos: {formatMoney(item.total_payments)}</ThemedText>
      <ThemedText>Saldo final: {formatMoney(item.final_balance)}</ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <FlatList data={closings} keyExtractor={item => item.id.toString()} renderItem={renderItem} contentContainerStyle={styles.list} ListEmptyComponent={<ThemedText>No hay cierres contables registrados.</ThemedText>} />
      {canCreate ? <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={() => router.push('/closings/create')}><ThemedText style={{ color: buttonTextColor }}>Crear cierre</ThemedText></TouchableOpacity> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  list: { paddingBottom: 100 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
});
