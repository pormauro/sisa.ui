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
  const { cashBoxes, selectedCashBox, setSelectedCashBox } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers } = useContext(ProvidersContext);
  const { clients, selectedClient, setSelectedClient } = useContext(ClientsContext);

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

  const selectedClientName = useMemo(() => {
    if (!payerClientId) return '';
    const parsedId = Number.parseInt(payerClientId, 10);
    if (Number.isNaN(parsedId)) return '';
    const client = clients.find(c => c.id === parsedId);
    return client?.business_name ?? '';
  }, [clients, payerClientId]);

  const selectedCashBoxName = useMemo(() => {
    if (selectedCashBox) {
      return selectedCashBox.name;
    }
    if (!paidInAccount) return '';
    const parsedId = Number.parseInt(paidInAccount, 10);
    if (Number.isNaN(parsedId)) return '';
    const cashBox = cashBoxes.find(cb => cb.id === parsedId);
    return cashBox?.name ?? '';
  }, [cashBoxes, paidInAccount, selectedCashBox]);

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
    if (selectedClient) {
      setPayerClientId(String(selectedClient.id));
      setSelectedClient(null);
    }
  }, [selectedClient, setSelectedClient]);

  useEffect(() => {
    if (selectedCashBox) {
      setPaidInAccount(String(selectedCashBox.id));
      setSelectedCashBox(null);
    }
  }, [selectedCashBox, setSelectedCashBox]);

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
      <View style={styles.selectionRow}>
        <TouchableOpacity
          style={[
            styles.input,
            styles.selectInput,
            { backgroundColor: inputBackground, borderColor },
            !canEdit ? styles.selectInputDisabled : null,
          ]}
          onPress={() => {
            if (!canEdit) return;
            const query = paidInAccount
              ? `?select=1&selectedId=${encodeURIComponent(paidInAccount)}`
              : '?select=1';
            router.push(`/cash_boxes${query}`);
          }}
          disabled={!canEdit}
        >
          <ThemedText
            style={{ color: paidInAccount ? inputTextColor : placeholderColor }}
          >
            {paidInAccount ? selectedCashBoxName || 'Caja no disponible' : '-- Selecciona cuenta --'}
          </ThemedText>
        </TouchableOpacity>
        {paidInAccount ? (
          <TouchableOpacity
            style={[styles.clearSelectionButton, { borderColor, opacity: canEdit ? 1 : 0.6 }]}
            onPress={() => canEdit && setPaidInAccount('')}
            disabled={!canEdit}
          >
            <ThemedText style={styles.clearSelectionText}>Quitar</ThemedText>
          </TouchableOpacity>
        ) : null}
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
              styles.selectInput,
              { backgroundColor: inputBackground, borderColor },
              !canEdit ? styles.selectInputDisabled : null,
            ]}
            onPress={() => {
              if (!canEdit) return;
              const targetId = payerClientId ? payerClientId : '';
              router.push(`/clients?select=1&selectedId=${targetId}`);
            }}
            disabled={!canEdit}
            activeOpacity={0.7}
          >
            <ThemedText
              style={[
                styles.selectInputText,
                { color: payerClientId ? inputTextColor : placeholderColor },
              ]}
            >
              {payerClientId
                ? selectedClientName || 'Cliente no disponible'
                : '-- Selecciona cliente --'}
            </ThemedText>
          </TouchableOpacity>
        </>
      )}

      {payerType === 'provider' && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
            <Picker
              selectedValue={payerProviderId}
              onValueChange={setPayerProviderId}
              style={[styles.picker, { color: inputTextColor }]}
              dropdownIconColor={inputTextColor}
            >
              <Picker.Item label="-- Selecciona proveedor --" value="" />
              {providers.map(p => (
                <Picker.Item key={p.id} label={p.business_name} value={p.id.toString()} />
              ))}
            </Picker>
          </View>
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
          <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
            <Picker
              selectedValue={providerId}
              onValueChange={setProviderId}
              style={[styles.picker, { color: inputTextColor }]}
              dropdownIconColor={inputTextColor}
            >
              <Picker.Item label="-- Selecciona proveedor --" value="" />
              {providers.map(p => (
                <Picker.Item key={p.id} label={p.business_name} value={p.id.toString()} />
              ))}
            </Picker>
          </View>
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
  selectInput: { justifyContent: 'center', flex: 1, marginBottom: 0 },
  selectInputDisabled: { opacity: 0.6 },
  selectInputText: { fontSize: 16 },
  selectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  clearSelectionButton: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  clearSelectionText: { fontSize: 14, fontWeight: '600' },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
