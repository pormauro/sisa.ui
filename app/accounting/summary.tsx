import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ensureAuthResponse, isTokenExpiredError } from '@/utils/auth/tokenGuard';

type SummaryRow = {
  id?: number;
  cash_box_id?: number;
  name: string;
  income: number;
  payments: number;
  balance?: number;
  net?: number;
};

type AccountingSummary = {
  period: { start_date: string; end_date: string };
  totals: { income: number; payments: number; net: number };
  cash_boxes: SummaryRow[];
  clients: SummaryRow[];
  providers: SummaryRow[];
  reconciliation?: {
    issued_invoices_total?: number;
    paid_invoices_total?: number;
    applied_receipts_total?: number;
    issued_vs_receipts_gap?: number;
    paid_vs_receipts_gap?: number;
    income_vs_applied_gap?: number;
    payments_total?: number;
    counts?: { invoices?: number; receipts?: number; payments?: number };
  };
};

const getToday = () => new Date().toISOString().slice(0, 10);
const getMonthStart = () => `${getToday().slice(0, 8)}01`;

const formatMoney = (value?: number | null) => `$${(value ?? 0).toFixed(2)}`;

export default function AccountingSummaryScreen() {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { cashBoxes, loadCashBoxes } = useContext(CashBoxesContext);

  const [startDate, setStartDate] = useState(getMonthStart());
  const [endDate, setEndDate] = useState(getToday());
  const [cashBoxId, setCashBoxId] = useState('');
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

  const canView = permissions.includes('viewAccountingSummary');

  useEffect(() => {
    if (!canView) {
      Alert.alert('Acceso denegado', 'No tenes permiso para ver el resumen contable.');
      router.back();
    }
  }, [canView, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canView) return;
      void loadCashBoxes();
    }, [canView, loadCashBoxes]),
  );

  const cashBoxItems = useMemo(
    () => [
      { label: 'Todas las cajas', value: '' },
      ...cashBoxes.map(item => ({ label: item.name, value: item.id.toString() })),
    ],
    [cashBoxes],
  );

  const loadSummary = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (cashBoxId) {
        query.set('cash_box_id', cashBoxId);
      }
      const response = await fetch(`${BASE_URL}/accounting/summary?${query.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await ensureAuthResponse(response);
      const data = await response.json();
      setSummary((data?.summary as AccountingSummary) ?? null);
    } catch (error) {
      if (isTokenExpiredError(error)) return;
      console.error('Error loading accounting summary:', error);
      Alert.alert('Error', 'No se pudo cargar el resumen contable.');
    } finally {
      setLoading(false);
    }
  }, [canView, cashBoxId, endDate, startDate, token]);

  useFocusEffect(
    useCallback(() => {
      if (!canView) return;
      void loadSummary();
    }, [canView, loadSummary]),
  );

  const renderSection = (title: string, rows: SummaryRow[], useBalance = true) => (
    <View style={[styles.section, { borderColor }]}> 
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {rows.length === 0 ? <ThemedText style={{ color: secondaryText }}>Sin movimientos en el rango.</ThemedText> : null}
      {rows.map((row, index) => (
        <TouchableOpacity
          key={`${title}-${row.id ?? row.cash_box_id ?? index}`}
          style={styles.rowCard}
          activeOpacity={0.8}
          onPress={() => {
            if (title === 'Cajas' && row.cash_box_id) {
              router.push(`/cash_boxes/${row.cash_box_id}`);
              return;
            }
            if (title === 'Clientes') {
              router.push('/invoices');
              return;
            }
            if (title === 'Proveedores') {
              router.push('/payments');
            }
          }}
        >
          <ThemedText style={styles.rowTitle}>{row.name}</ThemedText>
          <ThemedText>Ingresos: {formatMoney(row.income)}</ThemedText>
          <ThemedText>Egresos: {formatMoney(row.payments)}</ThemedText>
          <ThemedText>{useBalance ? 'Balance' : 'Neto'}: {formatMoney(useBalance ? row.balance : row.net)}</ThemedText>
          <ThemedText style={{ color: secondaryText }}>Tocar para ver detalle relacionado</ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.title}>Resumen contable</ThemedText>
        <TextInput
          style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={secondaryText}
        />
        <TextInput
          style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={secondaryText}
        />
        <SearchableSelect
          style={styles.select}
          items={cashBoxItems}
          selectedValue={cashBoxId}
          onValueChange={value => setCashBoxId(value?.toString() ?? '')}
          placeholder="Filtrar por caja"
        />
        <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={() => void loadSummary()}>
          {loading ? <ActivityIndicator color={buttonTextColor} /> : <ThemedText style={{ color: buttonTextColor }}>Actualizar resumen</ThemedText>}
        </TouchableOpacity>

        {summary ? (
          <>
            <View style={[styles.summaryCard, { borderColor }]}> 
              <ThemedText style={styles.sectionTitle}>Totales del periodo</ThemedText>
              <ThemedText>Ingresos: {formatMoney(summary.totals.income)}</ThemedText>
              <ThemedText>Egresos: {formatMoney(summary.totals.payments)}</ThemedText>
              <ThemedText>Neto: {formatMoney(summary.totals.net)}</ThemedText>
            </View>
            {summary.reconciliation ? (
              <View style={[styles.summaryCard, { borderColor }]}> 
                <ThemedText style={styles.sectionTitle}>Conciliacion</ThemedText>
                <ThemedText>Facturas emitidas: {formatMoney(summary.reconciliation.issued_invoices_total)}</ThemedText>
                <ThemedText>Facturas pagadas: {formatMoney(summary.reconciliation.paid_invoices_total)}</ThemedText>
                <ThemedText>Recibos aplicados: {formatMoney(summary.reconciliation.applied_receipts_total)}</ThemedText>
                <ThemedText>Gap facturas vs ingresos: {formatMoney(summary.reconciliation.issued_vs_receipts_gap)}</ThemedText>
              <ThemedText>Gap pagos vs recibos aplicados: {formatMoney(summary.reconciliation.paid_vs_receipts_gap)}</ThemedText>
              <ThemedText>Gap ingresos vs recibos aplicados: {formatMoney(summary.reconciliation.income_vs_applied_gap)}</ThemedText>
              <ThemedText>Conteos: facturas {summary.reconciliation.counts?.invoices ?? 0} · recibos {summary.reconciliation.counts?.receipts ?? 0} · pagos {summary.reconciliation.counts?.payments ?? 0}</ThemedText>
              <View style={styles.quickActionsRow}>
                <TouchableOpacity style={[styles.quickActionButton, { borderColor }]} onPress={() => router.push('/invoices')}>
                  <ThemedText>Facturas</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickActionButton, { borderColor }]} onPress={() => router.push('/receipts')}>
                  <ThemedText>Recibos</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickActionButton, { borderColor }]} onPress={() => router.push('/payments')}>
                  <ThemedText>Pagos</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickActionButton, { borderColor }]} onPress={() => router.push('/journal_entries')}>
                  <ThemedText>Libro diario</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
            {renderSection('Cajas', summary.cash_boxes, false)}
            {renderSection('Clientes', summary.clients)}
            {renderSection('Proveedores', summary.providers)}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 80, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  select: { marginBottom: 4 },
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
  summaryCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  section: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  rowCard: { gap: 2, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#99999933' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickActionButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
});
