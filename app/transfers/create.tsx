import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AccountsContext } from '@/contexts/AccountsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { TransfersContext } from '@/contexts/TransfersContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';

const getNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export default function CreateTransferScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ origin_account_id?: string }>();
  const { accounts, loadAccounts } = useContext(AccountsContext);
  const { createTransfer } = useContext(TransfersContext);
  const { permissions } = useContext(PermissionsContext);

  const [originAccountId, setOriginAccountId] = useState(params.origin_account_id?.toString() ?? '');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [transferDate, setTransferDate] = useState(getNow());
  const [description, setDescription] = useState('');

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

  const canCreate = permissions.includes('addTransfer');

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Acceso denegado', 'No tenes permiso para crear transferencias.');
      router.back();
      return;
    }
    void loadAccounts('active');
  }, [canCreate, loadAccounts, router]);

  const accountItems = useMemo(
    () => accounts.filter(item => item.status === 'active').map(item => ({ label: `${item.name} (${item.code || item.type})`, value: item.id.toString() })),
    [accounts],
  );

  const handleSubmit = async () => {
    const originId = Number(originAccountId);
    const destinationId = Number(destinationAccountId);
    const parsedAmount = Number.parseFloat(amount.replace(',', '.'));

    if (!Number.isFinite(originId) || !Number.isFinite(destinationId) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Completa origen, destino y monto valido.');
      return;
    }

    const created = await createTransfer({
      origin_account_id: originId,
      destination_account_id: destinationId,
      amount: parsedAmount,
      transfer_date: transferDate.trim() || getNow(),
      description: description.trim() || null,
    });

    if (created) {
      Alert.alert('Transferencia creada', 'La transferencia se registro correctamente.');
      router.replace(`/transfers/${created.id}`);
      return;
    }

    Alert.alert('Error', 'No se pudo registrar la transferencia.');
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SearchableSelect style={styles.select} items={accountItems} selectedValue={originAccountId} onValueChange={value => setOriginAccountId(value?.toString() ?? '')} placeholder="Cuenta origen" />
        <SearchableSelect style={styles.select} items={accountItems} selectedValue={destinationAccountId} onValueChange={value => setDestinationAccountId(value?.toString() ?? '')} placeholder="Cuenta destino" />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={amount} onChangeText={setAmount} placeholder="Monto" placeholderTextColor={secondaryText} keyboardType="decimal-pad" />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={transferDate} onChangeText={setTransferDate} placeholder="AAAA-MM-DD HH:mm:ss" placeholderTextColor={secondaryText} />
        <TextInput style={[styles.input, styles.textArea, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={description} onChangeText={setDescription} placeholder="Descripcion" placeholderTextColor={secondaryText} multiline />
        <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={handleSubmit}>
          <ThemedText style={{ color: buttonTextColor }}>Guardar transferencia</ThemedText>
        </TouchableOpacity>
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
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
});
