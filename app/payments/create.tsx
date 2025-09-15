// app/payments/create.tsx
import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { PaymentsContext } from '@/contexts/PaymentsContext';
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

export default function CreatePayment() {
  const router = useRouter();
  const { addPayment } = useContext(PaymentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers, selectedProvider, setSelectedProvider } = useContext(ProvidersContext);
  const { clients, selectedClient, setSelectedClient } = useContext(ClientsContext);

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
  const [selectingClientFor, setSelectingClientFor] = useState<'creditor' | 'charge' | null>(
    null
  );
  const [selectingProviderFor, setSelectingProviderFor] = useState<'creditor' | null>(
    null
  );

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const pickerBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const creditorClientName = useMemo(() => {
    if (!creditorClientId) return '-- Selecciona cliente --';
    const found = clients.find(c => c.id.toString() === creditorClientId);
    return found ? found.business_name : '-- Selecciona cliente --';
  }, [clients, creditorClientId]);

  const creditorProviderName = useMemo(() => {
    if (!creditorProviderId) return '-- Selecciona proveedor --';
    const found = providers.find(p => p.id.toString() === creditorProviderId);
    return found ? found.business_name : '-- Selecciona proveedor --';
  }, [providers, creditorProviderId]);

  const chargeClientName = useMemo(() => {
    if (!chargeClientId) return '-- Selecciona cliente --';
    const found = clients.find(c => c.id.toString() === chargeClientId);
    return found ? found.business_name : '-- Selecciona cliente --';
  }, [clients, chargeClientId]);

  const displayCategories = useMemo(
    () => getDisplayCategories(categories, 'expense'),
    [categories]
  );

  useEffect(() => {
    if (!permissions.includes('addPayment')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar pagos.');
      router.back();
    }
  }, [permissions, router]);

  useEffect(() => {
    if (!selectedClient) return;

    if (selectingClientFor === 'creditor') {
      setCreditorClientId(selectedClient.id.toString());
    } else if (selectingClientFor === 'charge') {
      setChargeClientId(selectedClient.id.toString());
    }

    setSelectingClientFor(null);
    setSelectedClient(null);
  }, [selectedClient, selectingClientFor, setSelectedClient]);

  useEffect(() => {
    if (!selectedProvider || selectingProviderFor !== 'creditor') return;

    setCreditorProviderId(selectedProvider.id.toString());
    setSelectingProviderFor(null);
    setSelectedProvider(null);
  }, [selectedProvider, selectingProviderFor, setSelectedProvider]);

  const handleOpenClientSelector = useCallback(
    (target: 'creditor' | 'charge') => {
      setSelectingClientFor(target);
      const currentId = target === 'creditor' ? creditorClientId : chargeClientId;
      const query = currentId
        ? `?select=1&selectedId=${encodeURIComponent(currentId)}`
        : '?select=1';
      router.push(`/clients${query}`);
    },
    [router, creditorClientId, chargeClientId]
  );

  const handleOpenProviderSelector = useCallback(() => {
    setSelectingProviderFor('creditor');
    const query = creditorProviderId
      ? `?select=1&selectedId=${encodeURIComponent(creditorProviderId)}`
      : '?select=1';
    router.push(`/providers${query}`);
  }, [router, creditorProviderId]);

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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
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
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={paidWithAccount}
          onValueChange={setPaidWithAccount}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="-- Selecciona cuenta --" value="" />
          {cashBoxes.map(cb => (
            <Picker.Item key={cb.id} label={cb.name} value={cb.id.toString()} />
          ))}
        </Picker>
      </View>

      <ThemedText style={styles.label}>Tipo de acreedor</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={creditorType}
          onValueChange={(val) => setCreditorType(val as any)}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="Cliente" value="client" />
          <Picker.Item label="Proveedor" value="provider" />
          <Picker.Item label="Otro" value="other" />
        </Picker>
      </View>

      {creditorType === 'client' && (
        <>
          <ThemedText style={styles.label}>Cliente</ThemedText>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
            onPress={() => handleOpenClientSelector('creditor')}
          >
            <ThemedText
              style={{ color: creditorClientId ? inputTextColor : placeholderColor }}
            >
              {creditorClientName}
            </ThemedText>
          </TouchableOpacity>
        </>
      )}

      {creditorType === 'provider' && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
            onPress={handleOpenProviderSelector}
          >
            <ThemedText
              style={{ color: creditorProviderId ? inputTextColor : placeholderColor }}
            >
              {creditorProviderName}
            </ThemedText>
          </TouchableOpacity>
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
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={categoryId}
          onValueChange={setCategoryId}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="-- Selecciona categoría --" value="" />
          {displayCategories.map(c => (
            <Picker.Item
              key={c.id}
              label={`${' '.repeat(c.level * 2)}${c.name}`}
              value={c.id.toString()}
            />
          ))}
        </Picker>
      </View>

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
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
            onPress={() => handleOpenClientSelector('charge')}
          >
            <ThemedText
              style={{ color: chargeClientId ? inputTextColor : placeholderColor }}
            >
              {chargeClientName}
            </ThemedText>
          </TouchableOpacity>
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
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: { height: 50, width: '100%' },
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

