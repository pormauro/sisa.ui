// app/receipts/[id].tsx
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
import { Picker } from '@react-native-picker/picker';
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
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ReceiptDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updateReceipt');
  const canDelete = permissions.includes('deleteReceipt');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(id);
  const { receipts, updateReceipt, deleteReceipt } = useContext(ReceiptsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers, selectedProvider, setSelectedProvider } = useContext(ProvidersContext);
  const { clients } = useContext(ClientsContext);

  const receipt = receipts.find(r => r.id === receiptId);

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
  const [pendingProviderSelection, setPendingProviderSelection] = useState<
    'payer' | 'payProvider' | null
  >(null);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const pickerBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const selectedPayerProvider = useMemo(() => {
    if (!payerProviderId) return null;
    const id = parseInt(payerProviderId, 10);
    if (Number.isNaN(id)) return null;
    return providers.find(p => p.id === id) ?? null;
  }, [payerProviderId, providers]);

  const selectedPayProvider = useMemo(() => {
    if (!providerId) return null;
    const id = parseInt(providerId, 10);
    if (Number.isNaN(id)) return null;
    return providers.find(p => p.id === id) ?? null;
  }, [providerId, providers]);

  const displayCategories = useMemo(
    () => getDisplayCategories(categories, 'income'),
    [categories]
  );

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este recibo.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (receipt) {
      setReceiptDate(new Date(receipt.receipt_date.replace(' ', 'T')));
      setPaidInAccount(receipt.paid_in_account);
      setPayerType(receipt.payer_type);
      setPayerClientId(
        receipt.payer_client_id ? String(receipt.payer_client_id) : ''
      );
      setPayerProviderId(
        receipt.payer_provider_id ? String(receipt.payer_provider_id) : ''
      );
      setPayerOther(receipt.payer_other || '');
      setDescription(receipt.description || '');
      const attachments = receipt.attached_files
        ? (typeof receipt.attached_files === 'string'
            ? JSON.parse(receipt.attached_files)
            : receipt.attached_files)
        : [];
      setAttachedFiles(attachments.length ? JSON.stringify(attachments) : '');
      setCategoryId(String(receipt.category_id));
      setPrice(String(receipt.price));
      setPayProvider(receipt.pay_provider);
      setProviderId(
        receipt.provider_id
          ? String(receipt.provider_id)
          : ''
      );
    }
  }, [receipt]);

  useEffect(() => {
    if (!selectedProvider || !pendingProviderSelection) return;
    if (pendingProviderSelection === 'payer') {
      setPayerProviderId(String(selectedProvider.id));
    } else if (pendingProviderSelection === 'payProvider') {
      setProviderId(String(selectedProvider.id));
    }
    setPendingProviderSelection(null);
    setSelectedProvider(null);
  }, [
    pendingProviderSelection,
    selectedProvider,
    setSelectedProvider,
  ]);

  useEffect(() => {
    if (!payerProviderId) return;
    const id = parseInt(payerProviderId, 10);
    if (Number.isNaN(id)) return;
    const exists = providers.some(p => p.id === id);
    if (!exists) {
      setPayerProviderId('');
    }
  }, [providers, payerProviderId]);

  useEffect(() => {
    if (!providerId) return;
    const id = parseInt(providerId, 10);
    if (Number.isNaN(id)) return;
    const exists = providers.some(p => p.id === id);
    if (!exists) {
      setProviderId('');
    }
  }, [providers, providerId]);

  useEffect(() => {
    return () => {
      setPendingProviderSelection(null);
      setSelectedProvider(null);
    };
  }, [setSelectedProvider]);

  if (!receipt) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}>
        <ThemedText>Recibo no encontrado</ThemedText>
      </ThemedView>
    );
  }

  const handleUpdate = () => {
    Alert.alert('Confirmar actualización', '¿Actualizar este recibo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
            const success = await updateReceipt(receiptId, {
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
          if (success) {
            Alert.alert('Éxito', 'Recibo actualizado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar el recibo');
          }
        },
      },
    ]);
  };

  const openPayerProviderSelector = (currentId?: string) => {
    if (!canEdit) return;
    setPendingProviderSelection('payer');
    const path = currentId
      ? `/providers?select=1&selectedId=${currentId}`
      : '/providers?select=1';
    router.push(path);
  };

  const openPayProviderSelector = (currentId?: string) => {
    if (!canEdit) return;
    setPendingProviderSelection('payProvider');
    const path = currentId
      ? `/providers?select=1&selectedId=${currentId}`
      : '/providers?select=1';
    router.push(path);
  };

  const handleDelete = () => {
    Alert.alert('Confirmar eliminación', '¿Eliminar este recibo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteReceipt(receiptId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Recibo eliminado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar el recibo');
          }
        },
      },
    ]);
  };

  return (
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
        <ThemedText style={styles.label}>Fecha y hora</ThemedText>
        <TouchableOpacity
          style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
          onPress={() => canEdit && setShowDatePicker(true)}
          disabled={!canEdit}
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
          <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
            <Picker
              selectedValue={payerClientId}
              onValueChange={setPayerClientId}
              style={[styles.picker, { color: inputTextColor }]}
              dropdownIconColor={inputTextColor}
            >
              <Picker.Item label="-- Selecciona cliente --" value="" />
              {clients.map(c => (
                <Picker.Item key={c.id} label={c.business_name} value={c.id.toString()} />
              ))}
            </Picker>
          </View>
        </>
      )}

      {payerType === 'provider' && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <TouchableOpacity
            style={[
              styles.input,
              styles.selector,
              { backgroundColor: inputBackground, borderColor },
              !canEdit && styles.selectorDisabled,
            ]}
            onPress={() => openPayerProviderSelector(payerProviderId || undefined)}
            activeOpacity={canEdit ? 0.85 : 1}
            disabled={!canEdit}
          >
            <ThemedText
              style={{
                color: selectedPayerProvider ? inputTextColor : placeholderColor,
              }}
            >
              {selectedPayerProvider?.business_name || '-- Selecciona proveedor --'}
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
      <TextInput style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]} value={description} onChangeText={setDescription} />

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
      <TextInput style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]} value={price} onChangeText={setPrice} keyboardType="numeric" />

      <View style={styles.switchRow}>
        <ThemedText>Pagar al proveedor</ThemedText>
        <Switch value={payProvider} onValueChange={setPayProvider} />
      </View>

      {payProvider && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <TouchableOpacity
            style={[
              styles.input,
              styles.selector,
              { backgroundColor: inputBackground, borderColor },
              !canEdit && styles.selectorDisabled,
            ]}
            onPress={() => openPayProviderSelector(providerId || undefined)}
            activeOpacity={canEdit ? 0.85 : 1}
            disabled={!canEdit}
          >
            <ThemedText
              style={{
                color: selectedPayProvider ? inputTextColor : placeholderColor,
              }}
            >
              {selectedPayProvider?.business_name || '-- Selecciona proveedor --'}
            </ThemedText>
          </TouchableOpacity>
        </>
      )}

      <FileGallery filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} editable={canEdit} />

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
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: { height: 50, width: '100%' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  selector: { justifyContent: 'center' },
  selectorDisabled: { opacity: 0.6 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
