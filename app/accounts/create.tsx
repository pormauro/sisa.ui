import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { AccountsContext, AccountStatus, AccountType } from '@/contexts/AccountsContext';
import { MemberCompaniesContext } from '@/contexts/MemberCompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';

export default function CreateAccountScreen() {
  const router = useRouter();
  const { addAccount } = useContext(AccountsContext);
  const { memberCompanies } = useContext(MemberCompaniesContext);
  const { permissions } = useContext(PermissionsContext);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [type, setType] = useState<AccountType>('asset');
  const [status, setStatus] = useState<AccountStatus>('active');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [description, setDescription] = useState('');

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

  const canCreate = permissions.includes('addAccount');

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Acceso denegado', 'No tenes permiso para crear cuentas contables.');
      router.back();
    }
  }, [canCreate, router]);

  const companyItems = useMemo(
    () => memberCompanies.map(item => ({ label: item.business_name || `Empresa ${item.id}`, value: item.id.toString() })),
    [memberCompanies],
  );

  const handleSubmit = async () => {
    const parsedOpening = Number.parseFloat(openingBalance.replace(',', '.'));
    const parsedCompanyId = companyId ? Number(companyId) : null;

    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio.');
      return;
    }
    if (companyId && !Number.isFinite(parsedCompanyId)) {
      Alert.alert('Error', 'Selecciona una empresa valida.');
      return;
    }

    const created = await addAccount({
      name: name.trim(),
      code: code.trim() || null,
      company_id: parsedCompanyId,
      type,
      description: description.trim() || null,
      opening_balance: Number.isFinite(parsedOpening) ? parsedOpening : 0,
      status,
    });

    if (created) {
      Alert.alert('Cuenta creada', 'La cuenta contable se creo correctamente.');
      router.replace(`/accounts/${created.id}`);
      return;
    }

    Alert.alert('Error', 'No se pudo crear la cuenta.');
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
        <TextInput style={[styles.input, styles.textArea, { borderColor, backgroundColor: inputBackground, color: textColor }]} value={description} onChangeText={setDescription} placeholder="Descripcion" placeholderTextColor={secondaryText} multiline />
        <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={handleSubmit}>
          <ThemedText style={{ color: buttonTextColor }}>Guardar cuenta</ThemedText>
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
