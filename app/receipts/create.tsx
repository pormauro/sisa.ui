// app/receipts/create.tsx
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
import { useRouter, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
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

export default function CreateReceipt() {
  const router = useRouter();
  const { addReceipt } = useContext(ReceiptsContext);
  const { permissions } = useContext(PermissionsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers, selectedProvider, setSelectedProvider } = useContext(ProvidersContext);
  const { clients, selectedClient, setSelectedClient } = useContext(ClientsContext);
  const isFocused = useIsFocused();

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
  const [selectingProviderFor, setSelectingProviderFor] = useState<'payer' | 'payee' | null>(
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

  const displayCategories = useMemo(
    () => getDisplayCategories(categories, 'income'),
    [categories]
  );

  useEffect(() => {
    if (!permissions.includes('addReceipt')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar recibos.');
      router.back();
    }
  }, [permissions, router]);

  useFocusEffect(
    useCallback(() => {
      if (selectedClient) {
        setPayerClientId(selectedClient.id.toString());
        setSelectedClient(null);
      }
    }, [selectedClient, setSelectedClient, setPayerClientId])
  );

  useEffect(() => {
    if (!isFocused) return;
    if (!selectedProvider || !selectingProviderFor) return;

    if (selectingProviderFor === 'payer') {
      setPayerProviderId(selectedProvider.id.toString());
    } else if (selectingProviderFor === 'payee') {
      setProviderId(selectedProvider.id.toString());
    }

    setSelectingProviderFor(null);
    setSelectedProvider(null);
  }, [isFocused, selectedProvider, selectingProviderFor, setSelectedProvider]);

  const handleOpenClientSelector = useCallback(() => {
    const query = payerClientId
      ? `?select=1&selectedId=${encodeURIComponent(payerClientId)}`
      : '?select=1';
    router.push(`/clients${query}`);
  }, [router, payerClientId]);

  const clientButtonLabel = useMemo(() => {
    if (selectedClient) {
      return selectedClient.business_name;
    }
    if (payerClientId) {
      const found = clients.find(
        client => client.id === Number.parseInt(payerClientId, 10)
      );
      if (found) {
        return found.business_name;
      }
    }
    return '-- Selecciona cliente --';
  }, [clients, payerClientId, selectedClient]);

  const payerProviderName = useMemo(() => {
    if (!payerProviderId) return '-- Selecciona proveedor --';
    const found = providers.find(p => p.id.toString() === payerProviderId);
    return found ? found.business_name : '-- Selecciona proveedor --';
  }, [providers, payerProviderId]);

  const payProviderName = useMemo(() => {
    if (!providerId) return '-- Selecciona proveedor --';
    const found = providers.find(p => p.id.toString() === providerId);
    return found ? found.business_name : '-- Selecciona proveedor --';
  }, [providers, providerId]);

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

  const handleOpenPayerProviderSelector = useCallback(() => {
    setSelectingProviderFor('payer');
    const query = payerProviderId
      ? `?select=1&selectedId=${encodeURIComponent(payerProviderId)}`
      : '?select=1';
    router.push(`/providers${query}`);
  }, [router, payerProviderId]);

  const handleOpenPayProviderSelector = useCallback(() => {
    setSelectingProviderFor('payee');
    const query = providerId
      ? `?select=1&selectedId=${encodeURIComponent(providerId)}`
      : '?select=1';
    router.push(`/providers${query}`);
  }, [router, providerId]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
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
        <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={paidInAccount}
          onValueChange={setPaidInAccount}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="-- Selecciona cuenta --" value="" />
          {cashBoxes.map(cb => (
            <Picker.Item key={cb.id} label={cb.name} value={cb.id.toString()} />
          ))}
        </Picker>
      </View>

      <ThemedText style={styles.label}>Tipo de pagador</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={payerType}
          onValueChange={(val) => setPayerType(val as any)}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="Cliente" value="client" />
          <Picker.Item label="Proveedor" value="provider" />
          <Picker.Item label="Otro" value="other" />
        </Picker>
      </View>

      {payerType === 'client' && (
        <>
          <ThemedText style={styles.label}>Cliente</ThemedText>
          <TouchableOpacity
            style={[
              styles.input,
              { backgroundColor: inputBackground, borderColor },
            ]}
            onPress={handleOpenClientSelector}
          >
            <ThemedText style={{ color: inputTextColor }}>
              {clientButtonLabel}
            </ThemedText>
          </TouchableOpacity>
        </>
      )}

      {payerType === 'provider' && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
            onPress={handleOpenPayerProviderSelector}
          >
            <ThemedText
              style={{ color: payerProviderId ? inputTextColor : placeholderColor }}
            >
              {payerProviderName}
            </ThemedText>
          </TouchableOpacity>
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
      <TextInput style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]} value={price} onChangeText={setPrice} placeholder="Precio" keyboardType="numeric" placeholderTextColor={placeholderColor} />

      <View style={styles.switchRow}>
        <ThemedText>Pagar al proveedor</ThemedText>
        <Switch value={payProvider} onValueChange={setPayProvider} />
      </View>

      {payProvider && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
            onPress={handleOpenPayProviderSelector}
          >
            <ThemedText style={{ color: providerId ? inputTextColor : placeholderColor }}>
              {payProviderName}
            </ThemedText>
          </TouchableOpacity>
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
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: { height: 50, width: '100%' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
