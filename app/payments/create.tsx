// app/payments/create.tsx
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PaymentsContext } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ConfigContext } from '@/contexts/ConfigContext';
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

type PaymentTemplatePrefillParams = {
  templateId?: string | string[];
  fromTemplate?: string | string[];
  paidWithAccount?: string | string[];
  creditorType?: string | string[];
  creditorClientId?: string | string[];
  creditorProviderId?: string | string[];
  creditorOther?: string | string[];
  categoryId?: string | string[];
  amount?: string | string[];
  chargeClient?: string | string[];
  chargeClientId?: string | string[];
  paymentDate?: string | string[];
  description?: string | string[];
};

const toSingleParamValue = (value?: string | string[]): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const parseBooleanParam = (value?: string): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return true;
  }
  if (normalized === '0' || normalized === 'false') {
    return false;
  }
  return undefined;
};

export default function CreatePayment() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<PaymentTemplatePrefillParams>();
  const { addPayment } = useContext(PaymentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers } = useContext(ProvidersContext);
  const { clients } = useContext(ClientsContext);
  const { beginSelection, consumeSelection, pendingSelections } = usePendingSelection();
  const configContext = useContext(ConfigContext);

  const NEW_CLIENT_VALUE = '__new_client__';
  const NEW_PROVIDER_VALUE = '__new_provider__';
  const NEW_CATEGORY_VALUE = '__new_category__';
  const NEW_CASH_BOX_VALUE = '__new_cash_box__';

  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [paidWithAccount, setPaidWithAccount] = useState('');
  const [creditorType, setCreditorType] =
    useState<'client' | 'provider' | 'other'>('provider');
  const [creditorClientId, setCreditorClientId] = useState('');
  const [creditorProviderId, setCreditorProviderId] = useState('');
  const [creditorOther, setCreditorOther] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [chargeClient, setChargeClient] = useState(false);
  const [chargeClientId, setChargeClientId] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [appliedTemplateSignature, setAppliedTemplateSignature] = useState<string | null>(null);

  const templateIdParam = toSingleParamValue(searchParams.templateId);
  const fromTemplateParam = toSingleParamValue(searchParams.fromTemplate);
  const paidWithAccountParam = toSingleParamValue(searchParams.paidWithAccount);
  const creditorTypeParam = toSingleParamValue(searchParams.creditorType);
  const creditorClientIdParam = toSingleParamValue(searchParams.creditorClientId);
  const creditorProviderIdParam = toSingleParamValue(searchParams.creditorProviderId);
  const creditorOtherParam = toSingleParamValue(searchParams.creditorOther);
  const categoryIdParam = toSingleParamValue(searchParams.categoryId);
  const amountParam = toSingleParamValue(searchParams.amount);
  const chargeClientParam = toSingleParamValue(searchParams.chargeClient);
  const chargeClientIdParam = toSingleParamValue(searchParams.chargeClientId);
  const paymentDateParam = toSingleParamValue(searchParams.paymentDate);
  const descriptionParam = toSingleParamValue(searchParams.description);

  const templatePrefillSignature = useMemo(() => {
    if (!fromTemplateParam && !templateIdParam) {
      return null;
    }
    return JSON.stringify({
      templateId: templateIdParam ?? '',
      paidWithAccount: paidWithAccountParam ?? null,
      paymentDate: paymentDateParam ?? null,
      creditorType: creditorTypeParam ?? null,
      creditorClientId: creditorClientIdParam ?? null,
      creditorProviderId: creditorProviderIdParam ?? null,
      creditorOther: creditorOtherParam ?? null,
      categoryId: categoryIdParam ?? null,
      amount: amountParam ?? null,
      chargeClient: chargeClientParam ?? null,
      chargeClientId: chargeClientIdParam ?? null,
      description: descriptionParam ?? null,
    });
  }, [
    amountParam,
    categoryIdParam,
    chargeClientIdParam,
    chargeClientParam,
    creditorClientIdParam,
    creditorOtherParam,
    creditorProviderIdParam,
    creditorTypeParam,
    descriptionParam,
    paymentDateParam,
    fromTemplateParam,
    paidWithAccountParam,
    templateIdParam,
  ]);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const displayCategories = useMemo(
    () => getDisplayCategories(categories, 'expense'),
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

  const creditorTypeOptions = useMemo(
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
    if (!templatePrefillSignature) {
      if (appliedTemplateSignature !== null) {
        setAppliedTemplateSignature(null);
      }
      return;
    }

    if (appliedTemplateSignature === templatePrefillSignature) {
      return;
    }

    if (paidWithAccountParam !== undefined) {
      setPaidWithAccount(paidWithAccountParam);
    }

    if (
      creditorTypeParam === 'client' ||
      creditorTypeParam === 'provider' ||
      creditorTypeParam === 'other'
    ) {
      setCreditorType(creditorTypeParam);
      if (creditorTypeParam === 'client') {
        setCreditorClientId(creditorClientIdParam ?? '');
        setCreditorProviderId('');
        setCreditorOther('');
      } else if (creditorTypeParam === 'provider') {
        setCreditorProviderId(creditorProviderIdParam ?? '');
        setCreditorClientId('');
        setCreditorOther('');
      } else {
        setCreditorOther(creditorOtherParam ?? '');
        setCreditorClientId('');
        setCreditorProviderId('');
      }
    }

    if (categoryIdParam !== undefined) {
      setCategoryId(categoryIdParam);
    }

    if (amountParam !== undefined) {
      setPrice(amountParam);
    }

    if (descriptionParam !== undefined) {
      setDescription(descriptionParam);
    }

    const parsedChargeClient = parseBooleanParam(chargeClientParam);
    if (parsedChargeClient !== undefined) {
      setChargeClient(parsedChargeClient);
      setChargeClientId(parsedChargeClient ? chargeClientIdParam ?? '' : '');
    } else if (chargeClientIdParam !== undefined) {
      setChargeClient(true);
      setChargeClientId(chargeClientIdParam);
    }

    if (paymentDateParam) {
      const normalized = paymentDateParam.replace(' ', 'T');
      const parsedDate = new Date(normalized);
      if (!Number.isNaN(parsedDate.getTime())) {
        setPaymentDate(parsedDate);
      }
    }

    setAppliedTemplateSignature(templatePrefillSignature);
  }, [
    amountParam,
    appliedTemplateSignature,
    categoryIdParam,
    chargeClientIdParam,
    chargeClientParam,
    creditorClientIdParam,
    creditorOtherParam,
    creditorProviderIdParam,
    creditorTypeParam,
    descriptionParam,
    paymentDateParam,
    paidWithAccountParam,
    templatePrefillSignature,
  ]);

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
    if (!paidWithAccount) return;
    const exists = cashBoxes.some(cb => cb.id.toString() === paidWithAccount);
    if (exists) {
      return;
    }
    const pendingValue = pendingSelections[SELECTION_KEYS.payments.cashBox];
    if (
      pendingValue !== undefined &&
      pendingValue !== null &&
      String(pendingValue) === paidWithAccount
    ) {
      return;
    }
    setPaidWithAccount('');
  }, [cashBoxes, paidWithAccount, pendingSelections]);

  useEffect(() => {
    if (paidWithAccount) {
      return;
    }
    const defaultCashBoxId = configContext?.configDetails?.default_payment_cash_box_id;
    if (!defaultCashBoxId) {
      return;
    }
    const defaultCashBoxIdString = String(defaultCashBoxId);
    const exists = cashBoxes.some(cb => cb.id.toString() === defaultCashBoxIdString);
    if (!exists) {
      return;
    }
    setPaidWithAccount(defaultCashBoxIdString);
  }, [cashBoxes, configContext?.configDetails?.default_payment_cash_box_id, paidWithAccount]);

  useEffect(() => {
    const pendingCashBox = pendingSelections[SELECTION_KEYS.payments.cashBox];
    if (pendingCashBox === undefined || pendingCashBox === null) {
      return;
    }
    const pendingCashBoxId = String(pendingCashBox);
    const exists = cashBoxes.some(cb => cb.id.toString() === pendingCashBoxId);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.payments.cashBox);
    setPaidWithAccount(pendingCashBoxId);
  }, [pendingSelections, cashBoxes, consumeSelection]);

  useEffect(() => {
    if (!categoryId) return;
    const exists = categories.some(cat => cat.id.toString() === categoryId);
    if (!exists) {
      setCategoryId('');
    }
  }, [categories, categoryId]);

  useEffect(() => {
    const pendingCategory = pendingSelections[SELECTION_KEYS.payments.category];
    if (pendingCategory === undefined || pendingCategory === null) {
      return;
    }
    const pendingCategoryId = String(pendingCategory);
    const exists = categories.some(cat => cat.id.toString() === pendingCategoryId);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.payments.category);
    setCategoryId(pendingCategoryId);
  }, [pendingSelections, categories, consumeSelection]);

  useEffect(() => {
    if (!creditorClientId) return;
    const exists = clients.some(client => client.id.toString() === creditorClientId);
    if (exists) {
      return;
    }
    const pendingValue = pendingSelections[SELECTION_KEYS.payments.creditorClient];
    if (
      pendingValue !== undefined &&
      pendingValue !== null &&
      String(pendingValue) === creditorClientId
    ) {
      return;
    }
    setCreditorClientId('');
  }, [clients, creditorClientId, pendingSelections]);

  useEffect(() => {
    if (!creditorProviderId) return;
    const exists = providers.some(provider => provider.id.toString() === creditorProviderId);
    if (exists) {
      return;
    }
    const pendingValue = pendingSelections[SELECTION_KEYS.payments.creditorProvider];
    if (
      pendingValue !== undefined &&
      pendingValue !== null &&
      String(pendingValue) === creditorProviderId
    ) {
      return;
    }
    setCreditorProviderId('');
  }, [providers, creditorProviderId, pendingSelections]);

  useEffect(() => {
    if (!chargeClientId) return;
    const exists = clients.some(client => client.id.toString() === chargeClientId);
    if (exists) {
      return;
    }
    const pendingValue = pendingSelections[SELECTION_KEYS.payments.chargeClient];
    if (
      pendingValue !== undefined &&
      pendingValue !== null &&
      String(pendingValue) === chargeClientId
    ) {
      return;
    }
    setChargeClientId('');
  }, [clients, chargeClientId, pendingSelections]);

  useEffect(() => {
    const pendingCreditor = pendingSelections[SELECTION_KEYS.payments.creditorClient];
    if (pendingCreditor !== undefined && pendingCreditor !== null) {
      const pendingCreditorId = String(pendingCreditor);
      const exists = clients.some(client => client.id.toString() === pendingCreditorId);
      if (exists) {
        consumeSelection(SELECTION_KEYS.payments.creditorClient);
        setCreditorType('client');
        setCreditorClientId(pendingCreditorId);
      }
    }

    const pendingCharge = pendingSelections[SELECTION_KEYS.payments.chargeClient];
    if (pendingCharge !== undefined && pendingCharge !== null) {
      const pendingChargeId = String(pendingCharge);
      const exists = clients.some(client => client.id.toString() === pendingChargeId);
      if (exists) {
        consumeSelection(SELECTION_KEYS.payments.chargeClient);
        setChargeClient(true);
        setChargeClientId(pendingChargeId);
      }
    }
    const pendingProvider = pendingSelections[SELECTION_KEYS.payments.creditorProvider];
    if (pendingProvider !== undefined && pendingProvider !== null) {
      const pendingProviderId = String(pendingProvider);
      const exists = providers.some(provider => provider.id.toString() === pendingProviderId);
      if (exists) {
        consumeSelection(SELECTION_KEYS.payments.creditorProvider);
        setCreditorType('provider');
        setCreditorProviderId(pendingProviderId);
      }
    }
  }, [pendingSelections, clients, providers, consumeSelection]);

  useEffect(() => {
    if (!permissions.includes('addPayment')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar pagos.');
      router.back();
    }
  }, [permissions, router]);

  const handleSubmit = async () => {
    if (!categoryId || !price) {
      Alert.alert('Error', 'Completa los campos obligatorios.');
      return;
    }
    setLoading(true);
    const newPayment = await addPayment({
      payment_date: toMySQLDateTime(paymentDate),
      paid_with_account: paidWithAccount,
      creditor_type: creditorType,
      creditor_client_id:
        creditorType === 'client' && creditorClientId
          ? parseInt(creditorClientId, 10)
          : null,
      creditor_provider_id:
        creditorType === 'provider' && creditorProviderId
          ? parseInt(creditorProviderId, 10)
          : null,
      creditor_other: creditorType === 'other' ? creditorOther : null,
      description,
      attached_files: attachedFiles || null,
      category_id: parseInt(categoryId, 10),
      price: parseFloat(price),
      charge_client: chargeClient,
      client_id:
        chargeClient && chargeClientId ? parseInt(chargeClientId, 10) : null,
    });
    setLoading(false);
    if (newPayment) {
      Alert.alert('Éxito', 'Pago creado.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el pago.');
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
        <ThemedText style={{ color: inputTextColor }}>{toMySQLDateTime(paymentDate)}</ThemedText>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={paymentDate}
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const current = new Date(paymentDate);
              current.setFullYear(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate()
              );
              setPaymentDate(current);
              setShowTimePicker(true);
            }
          }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={paymentDate}
          mode="time"
          display="default"
          onChange={(_, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) {
              const current = new Date(paymentDate);
              current.setHours(
                selectedTime.getHours(),
                selectedTime.getMinutes()
              );
              setPaymentDate(current);
            }
          }}
        />
      )}

      <ThemedText style={styles.label}>Cuenta utilizada</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={cashBoxItems}
        selectedValue={paidWithAccount}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CASH_BOX_VALUE) {
            setPaidWithAccount('');
            beginSelection(SELECTION_KEYS.payments.cashBox);
            router.push('/cash_boxes/create');
            return;
          }
          setPaidWithAccount(stringValue);
        }}
        placeholder="-- Selecciona cuenta --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CASH_BOX_VALUE) return;
          beginSelection(SELECTION_KEYS.payments.cashBox);
          router.push(`/cash_boxes/${value}`);
        }}
      />

      <ThemedText style={styles.label}>Tipo de acreedor</ThemedText>
      <RadioGroup
        style={styles.radioGroup}
        options={creditorTypeOptions}
        value={creditorType}
        onValueChange={(val) => setCreditorType(val)}
      />

      {creditorType === 'client' && (
        <>
          <ThemedText style={styles.label}>Cliente</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={clientItems}
            selectedValue={creditorClientId}
            onValueChange={(value) => {
              const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CLIENT_VALUE) {
            setCreditorClientId('');
            beginSelection(SELECTION_KEYS.payments.creditorClient);
            router.push('/clients/create');
            return;
          }
          setCreditorClientId(stringValue);
        }}
        placeholder="-- Selecciona cliente --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CLIENT_VALUE) return;
          beginSelection(SELECTION_KEYS.payments.creditorClient);
          router.push(`/clients/${value}`);
        }}
      />
        </>
      )}

      {creditorType === 'provider' && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={providerItems}
            selectedValue={creditorProviderId}
            onValueChange={(value) => {
              const stringValue = value?.toString() ?? '';
              if (stringValue === NEW_PROVIDER_VALUE) {
                setCreditorProviderId('');
                beginSelection(SELECTION_KEYS.payments.creditorProvider);
                router.push('/providers/create');
                return;
              }
              setCreditorProviderId(stringValue);
            }}
            placeholder="-- Selecciona proveedor --"
            onItemLongPress={(item) => {
              const value = String(item.value ?? '');
              if (!value || value === NEW_PROVIDER_VALUE) return;
              beginSelection(SELECTION_KEYS.payments.creditorProvider);
              router.push(`/providers/${value}`);
            }}
          />
        </>
      )}

      {creditorType === 'other' && (
        <>
          <ThemedText style={styles.label}>Acreedor</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
            value={creditorOther}
            onChangeText={setCreditorOther}
            placeholder="Nombre del acreedor"
            placeholderTextColor={placeholderColor}
          />
        </>
      )}

      <ThemedText style={styles.label}>Descripción</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Descripción"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Categoría</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={categoryItems}
        selectedValue={categoryId}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CATEGORY_VALUE) {
            setCategoryId('');
            beginSelection(SELECTION_KEYS.payments.category);
            router.push({ pathname: '/categories/create', params: { type: 'expense' } });
            return;
          }
          setCategoryId(stringValue);
        }}
        placeholder="-- Selecciona categoría --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CATEGORY_VALUE) return;
          beginSelection(SELECTION_KEYS.payments.category);
          router.push(`/categories/${value}`);
        }}
      />

      <ThemedText style={styles.label}>Precio</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={price}
        onChangeText={setPrice}
        placeholder="Precio"
        keyboardType="numeric"
        placeholderTextColor={placeholderColor}
      />

      <View style={styles.switchRow}>
        <ThemedText>Cobrar al cliente</ThemedText>
        <Switch value={chargeClient} onValueChange={setChargeClient} />
      </View>

      {chargeClient && (
        <>
          <ThemedText style={styles.label}>Cliente a cobrar</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={clientItems}
            selectedValue={chargeClientId}
            onValueChange={(value) => {
              const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CLIENT_VALUE) {
            setChargeClientId('');
            beginSelection(SELECTION_KEYS.payments.chargeClient);
            router.push('/clients/create');
            return;
          }
          setChargeClientId(stringValue);
        }}
        placeholder="-- Selecciona cliente --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CLIENT_VALUE) return;
          beginSelection(SELECTION_KEYS.payments.chargeClient);
          router.push(`/clients/${value}`);
        }}
      />
        </>
      )}

      <FileGallery filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} editable />

      <TouchableOpacity style={[styles.submitButton, { backgroundColor: buttonColor }]} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear Pago</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  select: {
    marginBottom: 8,
  },
  radioGroup: {
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});

