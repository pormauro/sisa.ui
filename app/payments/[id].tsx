// app/payments/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { PaymentsContext } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toMySQLDateTime } from '@/utils/date';
import { getDisplayCategories } from '@/utils/categories';
import { FileGallery } from '@/components/FileGallery';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { RadioGroup } from '@/components/RadioGroup';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';

export default function PaymentDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updatePayment');
  const canDelete = permissions.includes('deletePayment');

  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    creditorClientId?: string;
    chargeClientId?: string;
    creditorProviderId?: string;
  }>();
  const { id } = params;
  const paymentId = Number(id);
  const { payments, loadPayments, updatePayment, deletePayment } = useContext(PaymentsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers } = useContext(ProvidersContext);
  const { clients } = useContext(ClientsContext);
  const { beginSelection, consumeSelection, pendingSelections } = usePendingSelection();

  const NEW_CLIENT_VALUE = '__new_client__';
  const NEW_PROVIDER_VALUE = '__new_provider__';
  const NEW_CATEGORY_VALUE = '__new_category__';
  const NEW_CASH_BOX_VALUE = '__new_cash_box__';

  const payment = payments.find(p => p.id === paymentId);

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
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const spinnerColor = useThemeColor({}, 'tint');

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

  const loadedPaidWithAccountId = useMemo(
    () => String(payment?.paid_with_account ?? ''),
    [payment?.paid_with_account]
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
    if (!paidWithAccount) {
      return;
    }
    if (cashBoxes.length === 0) {
      return;
    }
    const exists = cashBoxes.some(cb => String(cb.id) === paidWithAccount);
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
    if (loadedPaidWithAccountId && loadedPaidWithAccountId === paidWithAccount) {
      return;
    }
    setPaidWithAccount('');
  }, [cashBoxes, paidWithAccount, pendingSelections, loadedPaidWithAccountId]);

  useEffect(() => {
    const pendingCashBox = pendingSelections[SELECTION_KEYS.payments.cashBox];
    if (pendingCashBox === undefined || pendingCashBox === null) {
      return;
    }
    const pendingCashBoxId = String(pendingCashBox);
    const exists = cashBoxes.some(cb => String(cb.id) === pendingCashBoxId);
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
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este pago.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (payment) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setPaymentDate(new Date(payment.payment_date.replace(' ', 'T')));
      setPaidWithAccount(String(payment.paid_with_account ?? ''));
      setCreditorType(payment.creditor_type);
      setCreditorClientId(
        payment.creditor_client_id ? String(payment.creditor_client_id) : ''
      );
      setCreditorProviderId(
        payment.creditor_provider_id ? String(payment.creditor_provider_id) : ''
      );
      setCreditorOther(payment.creditor_other || '');
      setDescription(payment.description || '');
      const attachments = payment.attached_files
        ? (typeof payment.attached_files === 'string'
            ? JSON.parse(payment.attached_files)
            : payment.attached_files)
        : [];
      setAttachedFiles(attachments.length ? JSON.stringify(attachments) : '');
      setCategoryId(String(payment.category_id));
      setPrice(String(payment.price));
      setChargeClient(payment.charge_client);
      setChargeClientId(
        payment.client_id ? String(payment.client_id) : ''
      );
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadPayments()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [payment, hasAttemptedLoad, isFetchingItem, loadPayments]);

  if (!payment) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}>
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={spinnerColor} />
        ) : (
          <ThemedText>Pago no encontrado</ThemedText>
        )}
      </ThemedView>
    );
  }

  const handleUpdate = () => {
    Alert.alert('Confirmar actualización', '¿Actualizar este pago?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updatePayment(paymentId, {
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
              chargeClient && chargeClientId
                ? parseInt(chargeClientId, 10)
                : null,
          });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Pago actualizado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar el pago');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Confirmar eliminación', '¿Eliminar este pago?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deletePayment(paymentId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Pago eliminado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar el pago');
          }
        },
      },
    ]);
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
          onPress={() => canEdit && setShowDatePicker(true)}
          disabled={!canEdit}
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
        disabled={!canEdit}
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
        disabled={!canEdit}
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
            disabled={!canEdit}
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
            disabled={!canEdit}
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
        editable={canEdit}
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
        disabled={!canEdit}
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
        keyboardType="numeric"
        editable={canEdit}
      />

      <View style={styles.switchRow}>
        <ThemedText>Cobrar al cliente</ThemedText>
        <Switch value={chargeClient} onValueChange={setChargeClient} disabled={!canEdit} />
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
            disabled={!canEdit}
            onItemLongPress={(item) => {
            const value = String(item.value ?? '');
            if (!value || value === NEW_CLIENT_VALUE) return;
            beginSelection(SELECTION_KEYS.payments.chargeClient);
            router.push(`/clients/${value}`);
          }}
        />
        </>
      )}

      <FileGallery
        entityType="payment"
        entityId={paymentId}
        filesJson={attachedFiles}
        onChangeFilesJson={setAttachedFiles}
        editable={canEdit}
        invoiceMarkingEnabled
      />

      {canEdit && (
        <TouchableOpacity style={[styles.submitButton, { backgroundColor: buttonColor }]} onPress={handleUpdate} disabled={loading}>
          {loading ? <ActivityIndicator color={buttonTextColor} /> : <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar</ThemedText>}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>Eliminar</ThemedText>}
        </TouchableOpacity>
      )}
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
  deleteButton: {
    marginTop: 16,
    backgroundColor: '#dc3545',
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
