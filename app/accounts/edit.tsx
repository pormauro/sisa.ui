import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AccountsContext, AccountStatus, AccountType } from '@/contexts/AccountsContext';
import { MemberCompaniesContext } from '@/contexts/MemberCompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';

export default function EditAccountScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const { accounts, getAccount, updateAccount } = useContext(AccountsContext);
  const { memberCompanies } = useContext(MemberCompaniesContext);
  const { permissions } = useContext(PermissionsContext);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [type, setType] = useState<AccountType>('asset');
  const [status, setStatus] = useState<AccountStatus>('active');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [currentBalance, setCurrentBalance] = useState('0');
  const [description, setDescription] = useState('');

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

  const canEdit = permissions.includes('addAccount');
  const account = accounts.find(item => item.id === accountId);

  useEffect(() => {
    if (!canEdit) {
      Alert.alert('Acceso denegado', 'No tenes permiso para editar cuentas contables.');
      router.back();
      return;
    }
    if (Number.isFinite(accountId) && accountId > 0) {
      void getAccount(accountId);
    }
  }, [accountId, canEdit, getAccount, router]);

  useEffect(() => {
    if (!account) return;
    setName(account.name ?? '');
    setCode(account.code ?? '');
    setCompanyId(account.company_id ? String(account.company_id) : '');
    setType(account.type ?? 'asset');
    setStatus(account.status ?? 'active');
    setOpeningBalance(String(account.opening_balance ?? 0));
    setCurrentBalance(String(account.current_balance ?? 0));
    setDescription(account.description ?? '');
  }, [account]);

  const companyItems = useMemo(
    () => memberCompanies.map(item => ({ label: item.business_name || `Empresa ${item.id}`, value: item.id.toString() })),
    [memberCompanies],
  );

  const handleSubmit = async () => {
    const parsedOpening = Number.parseFloat(openingBalance.replace(',', '.'));
    const parsedCurrent = Number.parseFloat(currentBalance.replace(',', '.'));
    const parsedCompanyId = companyId ? Number(companyId) : null;

    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio.');
      return;
    }

    const updated = await updateAccount(accountId, {
      name: name.trim(),
      code: code.trim() || null,
      company_id: parsedCompanyId,
      type,
      description: description.trim() || null,
      opening_balance: Number.isFinite(parsedOpening) ? parsedOpening : 0,
      current_balance: Number.isFinite(parsedCurrent) ? parsedCurrent : 0,
      status,
    });

    if (updated) {
      Alert.alert('Cuenta actualizada', 'La cuenta contable se actualizo correctamente.');
      router.replace(`/accounts/${updated.id}`);
      return;
    }

    Alert.alert('Error', 'No se pudo actualizar la cuenta.');
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={secondaryText} />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={code} onChangeText={setCode} placeholder="Codigo" placeholderTextColor={secondaryText} />
        <SearchableSelect style={styles.select} items={companyItems} selectedValue={companyId} onValueChange={value => setCompanyId(value?.toString() ?? '')} placeholder="Empresa" />
        <SearchableSelect style={styles.select} items={[{ label: 'Activo', value: 'active' }, { label: 'Archivado', value: 'archived' }]} selectedValue={status} onValueChange={value => setStatus((value?.toString() as AccountStatus) || 'active')} showSearch={false} placeholder="Estado" />
        <SearchableSelect style={styles.select} items={[{ label: 'Activo', value: 'asset' }, { label: 'Pasivo', value: 'liability' }, { label: 'Patrimonio', value: 'equity' }, { label: 'Ingreso', value: 'income' }, { label: 'Gasto', value: 'expense' }]} selectedValue={type} onValueChange={value => setType((value?.toString() as AccountType) || 'asset')} showSearch={false} placeholder="Tipo" />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={openingBalance} onChangeText={setOpeningBalance} placeholder="Saldo inicial" placeholderTextColor={secondaryText} keyboardType="decimal-pad" />
        <TextInput style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={currentBalance} onChangeText={setCurrentBalance} placeholder="Saldo actual" placeholderTextColor={secondaryText} keyboardType="decimal-pad" />
        <TextInput style={[styles.input, styles.textArea, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={description} onChangeText={setDescription} placeholder="Descripcion" placeholderTextColor={secondaryText} multiline />
        <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={handleSubmit}>
          <ThemedText style={{ color: buttonTextColor }}>Guardar cambios</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: FORM_BOTTOM_SPACING, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  select: { marginBottom: 4 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center' },
});
