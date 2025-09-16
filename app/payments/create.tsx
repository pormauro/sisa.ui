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
import { useSelectionNavigation } from '@/hooks/useSelectionNavigation';

export default function CreatePayment() {
  const router = useRouter();
  const { addPayment } = useContext(PaymentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers } = useContext(ProvidersContext);
  const { clients } = useContext(ClientsContext);

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
    if (!paidWithAccount) return;
    const exists = cashBoxes.some(cb => cb.id.toString() === paidWithAccount);
    if (!exists) {
      setPaidWithAccount('');
    }
  }, [cashBoxes, paidWithAccount]);

  useEffect(() => {
    if (!categoryId) return;
    const exists = categories.some(cat => cat.id.toString() === categoryId);
    if (!exists) {
      setCategoryId('');
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (!creditorClientId) return;
    const exists = clients.some(client => client.id.toString() === creditorClientId);
    if (!exists) {
      setCreditorClientId('');
    }
  }, [clients, creditorClientId]);

  useEffect(() => {
    if (!creditorProviderId) return;
    const exists = providers.some(provider => provider.id.toString() === creditorProviderId);
    if (!exists) {
      setCreditorProviderId('');
    }
  }, [providers, creditorProviderId]);

  useEffect(() => {
    if (!chargeClientId) return;
    const exists = clients.some(client => client.id.toString() === chargeClientId);
    if (!exists) {
      setChargeClientId('');
    }
  }, [clients, chargeClientId]);

  useEffect(() => {
    if (!permissions.includes('addPayment')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar pagos.');
      router.back();
    }
  }, [permissions, router]);

  const creditorClientSelectionTexts = useMemo(
    () => ({
      selectTitle: 'Selecciona el cliente acreedor',
      selectSubtitle:
        'Toca un cliente para designarlo como acreedor del pago.',
      selectedLabel: 'Cliente acreedor:',
      pickerPlaceholder: '-- Selecciona cliente acreedor --',
      clearLabel: 'Quitar cliente acreedor',
    }),
    []
  );

  const chargeClientSelectionTexts = useMemo(
    () => ({
      selectTitle: 'Selecciona el cliente a cobrar',
      selectSubtitle: 'Elige el cliente al que se le cargará el pago.',
      selectedLabel: 'Cliente a cobrar:',
      pickerPlaceholder: '-- Selecciona cliente a cobrar --',
      clearLabel: 'Quitar cliente a cobrar',
    }),
    []
  );

  const creditorProviderSelectionTexts = useMemo(
    () => ({
      selectTitle: 'Selecciona el proveedor acreedor',
      selectSubtitle: 'Elige el proveedor al que corresponde el pago.',
      selectedLabel: 'Proveedor acreedor:',
      pickerPlaceholder: '-- Selecciona proveedor acreedor --',
      clearLabel: 'Quitar proveedor acreedor',
    }),
    []
  );

  const handleCreditorClientSelection = useCallback(
    (value: string | null) => {
      setCreditorClientId(value ?? '');
    },
    []
  );

  const handleChargeClientSelection = useCallback(
    (value: string | null) => {
      setChargeClientId(value ?? '');
    },
    []
  );

  const handleCreditorProviderSelection = useCallback(
    (value: string | null) => {
      setCreditorProviderId(value ?? '');
    },
    []
  );

  const { openSelector: openCreditorClientSelector } = useSelectionNavigation({
    selectionPath: '/clients',
    paramName: 'creditorClientId',
    returnPath: '/payments/create',
    currentValue: creditorClientId || null,
    onSelection: handleCreditorClientSelection,
    extraParams: creditorClientSelectionTexts,
  });

  const { openSelector: openChargeClientSelector } = useSelectionNavigation({
    selectionPath: '/clients',
    paramName: 'chargeClientId',
    returnPath: '/payments/create',
    currentValue: chargeClientId || null,
    onSelection: handleChargeClientSelection,
    extraParams: chargeClientSelectionTexts,
  });

  const { openSelector: openCreditorProviderSelector } = useSelectionNavigation({
    selectionPath: '/providers',
    paramName: 'creditorProviderId',
    returnPath: '/payments/create',
    currentValue: creditorProviderId || null,
    onSelection: handleCreditorProviderSelection,
    extraParams: creditorProviderSelectionTexts,
  });

  const handleOpenClientSelector = useCallback(
    (target: 'creditor' | 'charge') => {
      if (target === 'creditor') {
        openCreditorClientSelector();
      } else {
        openChargeClientSelector();
      }
    },
    [openCreditorClientSelector, openChargeClientSelector]
  );

  const handleOpenProviderSelector = useCallback(() => {
    openCreditorProviderSelector();
  }, [openCreditorProviderSelector]);

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

