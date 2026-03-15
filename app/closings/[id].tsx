import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { ClosingsContext } from '@/contexts/ClosingsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function ClosingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const closingId = Number(id);
  const { closings, loadClosings, deleteClosing, getClosingHistory } = useContext(ClosingsContext);
  const { cashBoxes, loadCashBoxes } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const deleteColor = '#dc3545';

  const canView = permissions.includes('listClosings') || permissions.includes('getClosing');
  const canDelete = permissions.includes('deleteClosing');
  const closing = useMemo(() => closings.find(item => item.id === closingId), [closingId, closings]);
  const cashBoxName = closing ? cashBoxes.find(item => item.id === closing.cash_box_id)?.name || `Caja ${closing.cash_box_id}` : '';

  useEffect(() => {
    if (!canView) {
      Alert.alert('Acceso denegado', 'No tenes permiso para ver este cierre.');
      router.back();
    }
  }, [canView, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canView || !Number.isFinite(closingId) || closingId <= 0) return;
      void loadClosings();
      void loadCashBoxes();
      void getClosingHistory(closingId).then(records => setHistory(records as Record<string, unknown>[]));
    }, [canView, closingId, getClosingHistory, loadCashBoxes, loadClosings]),
  );

  const handleDelete = async () => {
    Alert.alert('Eliminar cierre', 'Esta accion no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteClosing(closingId);
          if (ok) {
            router.replace('/closings');
          } else {
            Alert.alert('Error', 'No se pudo eliminar el cierre.');
          }
        },
      },
    ]);
  };

  if (!Number.isFinite(closingId) || closingId <= 0 || !closing) {
    return <ThemedView style={[styles.container, { backgroundColor: background }]}><ThemedText>Cierre no encontrado.</ThemedText></ThemedView>;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { borderColor }]}>
          <ThemedText style={styles.title}>{cashBoxName}</ThemedText>
          <ThemedText>Fecha: {closing.closing_date}</ThemedText>
          <ThemedText>Ingresos: {formatMoney(closing.total_income)}</ThemedText>
          <ThemedText>Egresos: {formatMoney(closing.total_payments)}</ThemedText>
          <ThemedText>Saldo final: {formatMoney(closing.final_balance)}</ThemedText>
          <ThemedText>Comentarios: {closing.comments || 'Sin comentarios'}</ThemedText>
        </View>
        <View style={[styles.card, { borderColor }]}>
          <ThemedText style={styles.title}>Historial</ThemedText>
          {history.length === 0 ? <ThemedText>Sin historial disponible.</ThemedText> : null}
          {history.map((item, index) => (
            <View key={`${item.id ?? index}`} style={styles.historyRow}>
              <ThemedText>{String(item.action_type || 'CAMBIO')}</ThemedText>
              <ThemedText>{String(item.created_at || item.changed_at || '')}</ThemedText>
            </View>
          ))}
        </View>
        {canDelete ? <TouchableOpacity style={[styles.deleteButton, { backgroundColor: deleteColor }]} onPress={handleDelete}><ThemedText style={styles.deleteText}>Eliminar cierre</ThemedText></TouchableOpacity> : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: FORM_BOTTOM_SPACING, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  title: { fontSize: 18, fontWeight: '700' },
  historyRow: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#99999933' },
  deleteButton: { padding: 14, borderRadius: 10, alignItems: 'center' },
  deleteText: { color: '#fff', fontWeight: '700' },
});
