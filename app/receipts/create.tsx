// app/receipts/create.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ReceiptsContext } from '@/contexts/ReceiptsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toMySQLDateTime } from '@/utils/date';
import { getDisplayCategories } from '@/utils/categories';
import FileGallery from '@/components/FileGallery';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { RadioGroup } from '@/components/RadioGroup';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';

export default function CreateReceipt() {
  const router = useRouter();
  const { addReceipt } = useContext(ReceiptsContext);
  const { permissions } = useContext(PermissionsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers } = useContext(ProvidersContext);
  const { clients } = useContext(ClientsContext);
  const { beginSelection, consumeSelection, pendingSelections } = usePendingSelection();

  const NEW_CLIENT_VALUE = '__new_client__';
  const NEW_PROVIDER_VALUE = '__new_provider__';
  const NEW_CATEGORY_VALUE = '__new_category__';
  const NEW_CASH_BOX_VALUE = '__new_cash_box__';

  const [receiptDate, setReceiptDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [paidInAccount, setPaidInAccount] = useState('');
  const [payerType, setPayerType] = useState<'client' | 'provider' | 'other'>('client');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [payProvider, setPayProvider] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [payerClientId, setPayerClientId] = useState('');
  const [payerProviderId, setPayerProviderId] = useState('');
  const [payerOther, setPayerOther] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const displayCategories = useMemo(
    () => getDisplayCategories(categories, 'income'),
    [categories]
  );

  const cashBoxItems = useMemo(
    () => [
      { label: '-- Selecciona cuenta --', value: '' },
      { label: '➕ Nueva caja', value: NEW_CASH_BOX_VALUE },
      ...cashBoxes.map(cb => ({ label: cb.name, value: cb.id.toString() })),
    ],
    [cashBoxes]
  );

  const payerTypeOptions = useMemo(
    () => [
      { label: 'Cliente', value: 'client' },
      { label: 'Proveedor', value: 'provider' },
      { label: 'Otro', value: 'other' },
    ],
    []
  );

  const clientItems = useMemo(
    () => [
      { label: '-- Selecciona cliente --', value: '' },
      { label: '➕ Nuevo cliente', value: NEW_CLIENT_VALUE },
      ...clients.map(client => ({
        label: client.business_name,
        value: client.id.toString(),
      })),
    ],
    [clients]
  );

  const providerItems = useMemo(
    () => [
      { label: '-- Selecciona proveedor --', value: '' },
      { label: '➕ Nuevo proveedor', value: NEW_PROVIDER_VALUE },
      ...providers.map(provider => ({
        label: provider.business_name,
        value: provider.id.toString(),
      })),
    ],
    [providers]
  );

  const categoryItems = useMemo(
    () => [
      { label: '-- Selecciona categoría --', value: '' },
      { label: '➕ Nueva categoría', value: NEW_CATEGORY_VALUE },
      ...displayCategories.map(c => ({
        label: `${' '.repeat(c.level * 2)}${c.name}`,
        value: c.id.toString(),
      })),
    ],
    [displayCategories]
  );

  useEffect(() => {
    if (categoryId) {
      return;
    }
    if (!displayCategories.length) {
      return;
    }
    setCategoryId(displayCategories[0].id.toString());
  }, [displayCategories, categoryId]);

  useEffect(() => {
    if (!paidInAccount) return;
    const exists = cashBoxes.some(cb => cb.id.toString() === paidInAccount);
    if (exists) {
      return;
    }
    const pendingValue = pendingSelections[SELECTION_KEYS.receipts.cashBox];
    if (
      pendingValue !== undefined &&
      pendingValue !== null &&
      String(pendingValue) === paidInAccount
    ) {
      return;
    }
    setPaidInAccount('');
  }, [cashBoxes, paidInAccount, pendingSelections]);

  useEffect(() => {
    const pendingCashBox = pendingSelections[SELECTION_KEYS.receipts.cashBox];
    if (pendingCashBox === undefined || pendingCashBox === null) {
      return;
    }
    const pendingCashBoxId = String(pendingCashBox);
    const exists = cashBoxes.some(cb => cb.id.toString() === pendingCashBoxId);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.receipts.cashBox);
    setPaidInAccount(pendingCashBoxId);
  }, [pendingSelections, cashBoxes, consumeSelection]);

  useEffect(() => {
    if (!categoryId) return;
    const exists = categories.some(cat => cat.id.toString() === categoryId);
    if (!exists) {
      setCategoryId('');
    }
  }, [categories, categoryId]);

  useEffect(() => {
    const pendingCategory = pendingSelections[SELECTION_KEYS.receipts.category];
    if (pendingCategory === undefined || pendingCategory === null) {
      return;
    }
    const pendingCategoryId = String(pendingCategory);
    const exists = categories.some(cat => cat.id.toString() === pendingCategoryId);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.receipts.category);
    setCategoryId(pendingCategoryId);
  }, [pendingSelections, categories, consumeSelection]);

  useEffect(() => {
    if (!payerClientId) return;
    const exists = clients.some(client => client.id.toString() === payerClientId);
    if (exists) {
      return;
    }
    const pendingValue = pendingSelections[SELECTION_KEYS.receipts.payerClient];
    if (
      pendingValue !== undefined &&
      pendingValue !== null &&
      String(pendingValue) === payerClientId
    ) {
      return;
    }
    setPayerClientId('');
  }, [clients, payerClientId, pendingSelections]);

  useEffect(() => {
    const pendingValue = pendingSelections[SELECTION_KEYS.receipts.payerClient];
    if (pendingValue === undefined || pendingValue === null) {
      return;
    }
    const pendingClientId = String(pendingValue);
    const exists = clients.some(client => client.id.toString() === pendingClientId);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.receipts.payerClient);
    setPayerType('client');
    setPayerClientId(pendingClientId);
  }, [pendingSelections, clients, consumeSelection]);

  useEffect(() => {
    const pendingPayerProvider = pendingSelections[SELECTION_KEYS.receipts.payerProvider];
    if (pendingPayerProvider !== undefined && pendingPayerProvider !== null) {
      const pendingProviderId = String(pendingPayerProvider);
      const exists = providers.some(provider => provider.id.toString() === pendingProviderId);
      if (exists) {
        consumeSelection(SELECTION_KEYS.receipts.payerProvider);
        setPayerType('provider');
        setPayerProviderId(pendingProviderId);
      }
    }

    const pendingProvider = pendingSelections[SELECTION_KEYS.receipts.provider];
    if (pendingProvider !== undefined && pendingProvider !== null) {
      const pendingProviderId = String(pendingProvider);
      const exists = providers.some(provider => provider.id.toString() === pendingProviderId);
      if (exists) {
        consumeSelection(SELECTION_KEYS.receipts.provider);
        setPayProvider(true);
        setProviderId(pendingProviderId);
      }
    }
  }, [pendingSelections, providers, consumeSelection]);

  useEffect(() => {
    if (!payerProviderId) return;
    const exists = providers.some(provider => provider.id.toString() === payerProviderId);
    if (exists) {
      return;
    }
    const pendingValue = pendingSelections[SELECTION_KEYS.receipts.payerProvider];
    if (
      pendingValue !== undefined &&
      pendingValue !== null &&
      String(pendingValue) === payerProviderId
    ) {
      return;
    }
    setPayerProviderId('');
  }, [providers, payerProviderId, pendingSelections]);

  useEffect(() => {
    if (!providerId) return;
    const exists = providers.some(provider => provider.id.toString() === providerId);
    if (exists) {
      return;
    }
    const pendingValue = pendingSelections[SELECTION_KEYS.receipts.provider];
    if (
      pendingValue !== undefined &&
      pendingValue !== null &&
      String(pendingValue) === providerId
    ) {
      return;
    }
    setProviderId('');
  }, [providers, providerId, pendingSelections]);

  useEffect(() => {
    if (!permissions.includes('addReceipt')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar recibos.');
      router.back();
    }
  }, [permissions, router]);

  const handleSubmit = async () => {
    if (!categoryId || !price) {
      Alert.alert('Error', 'Completa los campos obligatorios.');
      return;
    }
    setLoading(true);
    const newReceipt = await addReceipt({
      receipt_date: toMySQLDateTime(receiptDate),
      paid_in_account: paidInAccount,
      payer_type: payerType,
      payer_client_id:
        payerType === 'client' && payerClientId
          ? parseInt(payerClientId, 10)
          : null,
      payer_provider_id:
        payerType === 'provider' && payerProviderId
          ? parseInt(payerProviderId, 10)
          : null,
      payer_other: payerType === 'other' ? payerOther : null,
      description,
      attached_files: attachedFiles || null,
      category_id: parseInt(categoryId, 10),
      price: parseFloat(price),
      pay_provider: payProvider,
      provider_id:
        payProvider && providerId ? parseInt(providerId, 10) : null,
    });
    setLoading(false);
    if (newReceipt) {
      Alert.alert('Éxito', 'Recibo creado.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el recibo.');
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
        <ThemedText style={styles.label}>Fecha y hora</ThemedText>
        <TouchableOpacity
          style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
          onPress={() => setShowDatePicker(true)}
        >
          <ThemedText style={{ color: inputTextColor }}>{toMySQLDateTime(receiptDate)}</ThemedText>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={receiptDate}
            mode="date"
            display="default"
            onChange={(_, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const current = new Date(receiptDate);
                current.setFullYear(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth(),
                  selectedDate.getDate()
                );
                setReceiptDate(current);
                setShowTimePicker(true);
              }
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={receiptDate}
            mode="time"
            display="default"
            onChange={(_, selectedTime) => {
              setShowTimePicker(false);
              if (selectedTime) {
                const current = new Date(receiptDate);
                current.setHours(
                  selectedTime.getHours(),
                  selectedTime.getMinutes()
                );
                setReceiptDate(current);
              }
            }}
          />
        )}

      <ThemedText style={styles.label}>Cuenta de ingreso</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={cashBoxItems}
        selectedValue={paidInAccount}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CASH_BOX_VALUE) {
            setPaidInAccount('');
            beginSelection(SELECTION_KEYS.receipts.cashBox);
            router.push('/cash_boxes/create');
            return;
          }
          setPaidInAccount(stringValue);
        }}
        placeholder="-- Selecciona cuenta --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CASH_BOX_VALUE) return;
          beginSelection(SELECTION_KEYS.receipts.cashBox);
          router.push(`/cash_boxes/${value}`);
        }}
      />

      <ThemedText style={styles.label}>Tipo de pagador</ThemedText>
      <RadioGroup
        style={styles.radioGroup}
        options={payerTypeOptions}
        value={payerType}
        onValueChange={(val) => setPayerType(val)}
      />

      {payerType === 'client' && (
        <>
          <ThemedText style={styles.label}>Cliente</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={clientItems}
            selectedValue={payerClientId}
            onValueChange={(value) => {
              const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CLIENT_VALUE) {
            setPayerClientId('');
            beginSelection(SELECTION_KEYS.receipts.payerClient);
            router.push('/clients/create');
            return;
          }
          setPayerClientId(stringValue);
        }}
        placeholder="-- Selecciona cliente --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CLIENT_VALUE) return;
          beginSelection(SELECTION_KEYS.receipts.payerClient);
          router.push(`/clients/${value}`);
        }}
      />
        </>
      )}

      {payerType === 'provider' && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={providerItems}
            selectedValue={payerProviderId}
            onValueChange={(value) => {
              const stringValue = value?.toString() ?? '';
              if (stringValue === NEW_PROVIDER_VALUE) {
                setPayerProviderId('');
                beginSelection(SELECTION_KEYS.receipts.payerProvider);
                router.push('/providers/create');
                return;
              }
              setPayerProviderId(stringValue);
            }}
            placeholder="-- Selecciona proveedor --"
            onItemLongPress={(item) => {
              const value = String(item.value ?? '');
              if (!value || value === NEW_PROVIDER_VALUE) return;
              beginSelection(SELECTION_KEYS.receipts.payerProvider);
              router.push(`/providers/${value}`);
            }}
          />
        </>
      )}

      {payerType === 'other' && (
        <>
          <ThemedText style={styles.label}>Pagador</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
            value={payerOther}
            onChangeText={setPayerOther}
            placeholder="Nombre del pagador"
            placeholderTextColor={placeholderColor}
          />
        </>
      )}

      <ThemedText style={styles.label}>Descripción</ThemedText>
      <TextInput style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]} value={description} onChangeText={setDescription} placeholder="Descripción" placeholderTextColor={placeholderColor} />

      <ThemedText style={styles.label}>Categoría</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={categoryItems}
        selectedValue={categoryId}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CATEGORY_VALUE) {
            setCategoryId('');
            beginSelection(SELECTION_KEYS.receipts.category);
            router.push({ pathname: '/categories/create', params: { type: 'income' } });
            return;
          }
          setCategoryId(stringValue);
        }}
        placeholder="-- Selecciona categoría --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CATEGORY_VALUE) return;
          beginSelection(SELECTION_KEYS.receipts.category);
          router.push(`/categories/${value}`);
        }}
      />

      <ThemedText style={styles.label}>Precio</ThemedText>
      <TextInput style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]} value={price} onChangeText={setPrice} placeholder="Precio" keyboardType="numeric" placeholderTextColor={placeholderColor} />

      <View style={styles.switchRow}>
        <ThemedText>Pagar al proveedor</ThemedText>
        <Switch value={payProvider} onValueChange={setPayProvider} />
      </View>

      {payProvider && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={providerItems}
            selectedValue={providerId}
            onValueChange={(value) => {
              const stringValue = value?.toString() ?? '';
              if (stringValue === NEW_PROVIDER_VALUE) {
                setProviderId('');
                beginSelection(SELECTION_KEYS.receipts.provider);
                router.push('/providers/create');
                return;
              }
              setProviderId(stringValue);
            }}
            placeholder="-- Selecciona proveedor --"
            onItemLongPress={(item) => {
              const value = String(item.value ?? '');
              if (!value || value === NEW_PROVIDER_VALUE) return;
              beginSelection(SELECTION_KEYS.receipts.provider);
              router.push(`/providers/${value}`);
            }}
          />
        </>
      )}

      <FileGallery filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} editable />

      <TouchableOpacity style={[styles.submitButton, { backgroundColor: buttonColor }]} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color={buttonTextColor} /> : <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear Recibo</ThemedText>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  select: {
    marginBottom: 8,
  },
  radioGroup: {
    marginBottom: 8,
  },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
