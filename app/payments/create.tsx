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
  const { providers } = useContext(ProvidersContext);
  const { clients } = useContext(ClientsContext);

  const NEW_CLIENT_VALUE = '__new_client__';
  const NEW_PROVIDER_VALUE = '__new_provider__';

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
          <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
            <Picker
              selectedValue={creditorClientId}
              onValueChange={(value) => {
                if (value === NEW_CLIENT_VALUE) {
                  setCreditorClientId('');
                  router.push('/clients/create');
                } else {
                  setCreditorClientId(value);
                }
              }}
              style={[styles.picker, { color: inputTextColor }]}
              dropdownIconColor={inputTextColor}
            >
              <Picker.Item label="-- Selecciona cliente --" value="" />
              <Picker.Item label="➕ Nuevo cliente" value={NEW_CLIENT_VALUE} />
              {clients.map(client => (
                <Picker.Item
                  key={client.id}
                  label={client.business_name}
                  value={client.id.toString()}
                />
              ))}
            </Picker>
          </View>
        </>
      )}

      {creditorType === 'provider' && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
            <Picker
              selectedValue={creditorProviderId}
              onValueChange={(value) => {
                if (value === NEW_PROVIDER_VALUE) {
                  setCreditorProviderId('');
                  router.push('/providers/create');
                } else {
                  setCreditorProviderId(value);
                }
              }}
              style={[styles.picker, { color: inputTextColor }]}
              dropdownIconColor={inputTextColor}
            >
              <Picker.Item label="-- Selecciona proveedor --" value="" />
              <Picker.Item label="➕ Nuevo proveedor" value={NEW_PROVIDER_VALUE} />
              {providers.map(provider => (
                <Picker.Item
                  key={provider.id}
                  label={provider.business_name}
                  value={provider.id.toString()}
                />
              ))}
            </Picker>
          </View>
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
          <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
            <Picker
              selectedValue={chargeClientId}
              onValueChange={(value) => {
                if (value === NEW_CLIENT_VALUE) {
                  setChargeClientId('');
                  router.push('/clients/create');
                } else {
                  setChargeClientId(value);
                }
              }}
              style={[styles.picker, { color: inputTextColor }]}
              dropdownIconColor={inputTextColor}
            >
              <Picker.Item label="-- Selecciona cliente --" value="" />
              <Picker.Item label="➕ Nuevo cliente" value={NEW_CLIENT_VALUE} />
              {clients.map(client => (
                <Picker.Item
                  key={client.id}
                  label={client.business_name}
                  value={client.id.toString()}
                />
              ))}
            </Picker>
          </View>
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

