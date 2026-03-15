import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { ClosingsContext, AccountingClosingPreview } from '@/contexts/ClosingsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';

const getNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export default function CreateClosingScreen() {
  const router = useRouter();
  const { cashBoxes, loadCashBoxes } = useContext(CashBoxesContext);
  const { addClosing, previewClosing } = useContext(ClosingsContext);
  const { permissions } = useContext(PermissionsContext);

  const [cashBoxId, setCashBoxId] = useState('');
  const [closingDate, setClosingDate] = useState(getNow());
  const [finalBalance, setFinalBalance] = useState('0');
  const [totalIncome, setTotalIncome] = useState('0');
  const [totalPayments, setTotalPayments] = useState('0');
  const [comments, setComments] = useState('');
  const [preview, setPreview] = useState<AccountingClosingPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

  const canCreate = permissions.includes('addClosing');

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Acceso denegado', 'No tenes permiso para crear cierres contables.');
      router.back();
      return;
    }
    void loadCashBoxes();
  }, [canCreate, loadCashBoxes, router]);

  const cashBoxItems = useMemo(() => cashBoxes.map(item => ({ label: item.name, value: item.id.toString() })), [cashBoxes]);

  const handleSubmit = async () => {
    const parsedCashBoxId = Number(cashBoxId);
    const parsedFinalBalance = Number.parseFloat(finalBalance.replace(',', '.'));
    const parsedIncome = Number.parseFloat(totalIncome.replace(',', '.'));
    const parsedPayments = Number.parseFloat(totalPayments.replace(',', '.'));

    if (!Number.isFinite(parsedCashBoxId) || !Number.isFinite(parsedFinalBalance) || !Number.isFinite(parsedIncome) || !Number.isFinite(parsedPayments)) {
      Alert.alert('Error', 'Completa todos los importes y la caja.');
      return;
    }

    const createdId = await addClosing({
      cash_box_id: parsedCashBoxId,
      closing_date: closingDate.trim() || getNow(),
      final_balance: parsedFinalBalance,
      total_income: parsedIncome,
      total_payments: parsedPayments,
      comments: comments.trim() || null,
    });

    if (createdId) {
      Alert.alert('Cierre creado', 'El cierre contable se creo correctamente.');
      router.replace(`/closings/${createdId}`);
      return;
    }

    Alert.alert('Error', 'No se pudo crear el cierre.');
  };

  const handlePreview = async () => {
    const parsedCashBoxId = Number(cashBoxId);
    const parsedFinalBalance = Number.parseFloat(finalBalance.replace(',', '.'));
    const parsedIncome = Number.parseFloat(totalIncome.replace(',', '.'));
    const parsedPayments = Number.parseFloat(totalPayments.replace(',', '.'));

    if (!Number.isFinite(parsedCashBoxId) || !closingDate.trim()) {
      Alert.alert('Error', 'Selecciona una caja y una fecha de cierre.');
      return;
    }

    setLoadingPreview(true);
    const result = await previewClosing({
      cash_box_id: parsedCashBoxId,
      closing_date: closingDate.trim() || getNow(),
      total_income: Number.isFinite(parsedIncome) ? parsedIncome : null,
      total_payments: Number.isFinite(parsedPayments) ? parsedPayments : null,
      final_balance: Number.isFinite(parsedFinalBalance) ? parsedFinalBalance : null,
    });
    setLoadingPreview(false);

    if (!result) {
      Alert.alert('Error', 'No se pudo generar la vista previa del cierre.');
      return;
    }

    setPreview(result);
    if (totalIncome === '0' && totalPayments === '0' && finalBalance === '0') {
      setTotalIncome(result.suggested.total_income.toFixed(2));
      setTotalPayments(result.suggested.total_payments.toFixed(2));
      setFinalBalance(result.suggested.final_balance.toFixed(2));
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SearchableSelect style={styles.select} items={cashBoxItems} selectedValue={cashBoxId} onValueChange={value => setCashBoxId(value?.toString() ?? '')} placeholder="Caja" />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={closingDate} onChangeText={setClosingDate} placeholder="AAAA-MM-DD HH:mm:ss" placeholderTextColor={secondaryText} />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={totalIncome} onChangeText={setTotalIncome} placeholder="Ingresos totales" placeholderTextColor={secondaryText} keyboardType="decimal-pad" />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={totalPayments} onChangeText={setTotalPayments} placeholder="Egresos totales" placeholderTextColor={secondaryText} keyboardType="decimal-pad" />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={finalBalance} onChangeText={setFinalBalance} placeholder="Saldo final" placeholderTextColor={secondaryText} keyboardType="decimal-pad" />
        <TextInput style={[styles.input, styles.textArea, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={comments} onChangeText={setComments} placeholder="Comentarios" placeholderTextColor={secondaryText} multiline />
        <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={() => void handlePreview()}>
          <ThemedText>{loadingPreview ? 'Calculando...' : 'Previsualizar cierre'}</ThemedText>
        </TouchableOpacity>
        {preview ? (
          <ThemedView style={[styles.previewCard, { borderColor, backgroundColor: inputBackground }]}>
            <ThemedText style={styles.previewTitle}>Vista previa</ThemedText>
            <ThemedText>{`Periodo: ${preview.period.start_date} -> ${preview.period.end_date}`}</ThemedText>
            <ThemedText>Ingreso sugerido: {preview.suggested.total_income.toFixed(2)}</ThemedText>
            <ThemedText>Egreso sugerido: {preview.suggested.total_payments.toFixed(2)}</ThemedText>
            <ThemedText>Saldo sugerido: {preview.suggested.final_balance.toFixed(2)}</ThemedText>
            <ThemedText>Diferencia ingreso: {(preview.differences.income ?? 0).toFixed(2)}</ThemedText>
            <ThemedText>Diferencia egreso: {(preview.differences.payments ?? 0).toFixed(2)}</ThemedText>
            <ThemedText>Diferencia saldo: {(preview.differences.final_balance ?? 0).toFixed(2)}</ThemedText>
            {preview.previous_closing ? <ThemedText>Ultimo cierre previo: #{String(preview.previous_closing.id ?? '-')}</ThemedText> : <ThemedText>Sin cierre previo</ThemedText>}
          </ThemedView>
        ) : null}
        <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={handleSubmit}><ThemedText style={{ color: buttonTextColor }}>Guardar cierre</ThemedText></TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: FORM_BOTTOM_SPACING, gap: 12 },
  select: { marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  secondaryButton: { borderWidth: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  previewCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  previewTitle: { fontSize: 16, fontWeight: '700' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
});
