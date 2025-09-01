// app/receipts/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  View,
  Text,
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
  const { providers } = useContext(ProvidersContext);
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
  const [loading, setLoading] = useState(false);

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
      if (receipt.items[0]) {
        setCategoryId(String(receipt.items[0].category_id));
        setPrice(String(receipt.items[0].price));
        setPayProvider(receipt.items[0].pay_provider);
        setProviderId(
          receipt.items[0].provider_id
            ? String(receipt.items[0].provider_id)
            : ''
        );
      }
    }
  }, [receipt]);

  if (!receipt) {
    return (
      <View style={styles.container}>
        <Text>Recibo no encontrado</Text>
      </View>
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
            items: [
              {
                category_id: parseInt(categoryId, 10),
                price: parseFloat(price),
                pay_provider: payProvider,
                provider_id:
                  payProvider && providerId ? parseInt(providerId, 10) : null,
              },
            ],
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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Fecha y hora</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => canEdit && setShowDatePicker(true)}
          disabled={!canEdit}
        >
          <Text>{toMySQLDateTime(receiptDate)}</Text>
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

        <Text style={styles.label}>Cuenta de ingreso</Text>
        <View style={styles.pickerWrap}>
        <Picker
          selectedValue={paidInAccount}
          onValueChange={setPaidInAccount}
          style={styles.picker}
        >
          <Picker.Item label="-- Selecciona cuenta --" value="" />
          {cashBoxes.map(cb => (
            <Picker.Item key={cb.id} label={cb.name} value={cb.id.toString()} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Tipo de pagador</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={payerType}
          onValueChange={(val) => setPayerType(val as any)}
          style={styles.picker}
        >
          <Picker.Item label="Cliente" value="client" />
          <Picker.Item label="Proveedor" value="provider" />
          <Picker.Item label="Otro" value="other" />
        </Picker>
      </View>

      {payerType === 'client' && (
        <>
          <Text style={styles.label}>Cliente</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={payerClientId}
              onValueChange={setPayerClientId}
              style={styles.picker}
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
          <Text style={styles.label}>Proveedor</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={payerProviderId}
              onValueChange={setPayerProviderId}
              style={styles.picker}
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
          <Text style={styles.label}>Pagador</Text>
          <TextInput
            style={styles.input}
            value={payerOther}
            onChangeText={setPayerOther}
            placeholder="Nombre del pagador"
          />
        </>
      )}

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={categoryId}
          onValueChange={setCategoryId}
          style={styles.picker}
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

      <Text style={styles.label}>Precio</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />

      <View style={styles.switchRow}>
        <Text>Pagar al proveedor</Text>
        <Switch value={payProvider} onValueChange={setPayProvider} />
      </View>

      {payProvider && (
        <>
          <Text style={styles.label}>Proveedor</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={providerId}
              onValueChange={setProviderId}
              style={styles.picker}
            >
              <Picker.Item label="-- Selecciona proveedor --" value="" />
              {providers.map(p => (
                <Picker.Item key={p.id} label={p.business_name} value={p.id.toString()} />
              ))}
            </Picker>
          </View>
        </>
      )}

      {canEdit && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUpdate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Actualizar</Text>}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Eliminar</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  picker: { height: 50, width: '100%' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#007bff', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
