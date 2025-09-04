// app/payments/[id].tsx
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
import { PaymentsContext } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toMySQLDateTime } from '@/utils/date';
import { getDisplayCategories } from '@/utils/categories';
import FileCarousel from '@/components/FileCarousel';

export default function PaymentDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updatePayment');
  const canDelete = permissions.includes('deletePayment');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Number(id);
  const { payments, updatePayment, deletePayment } = useContext(PaymentsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers } = useContext(ProvidersContext);
  const { clients } = useContext(ClientsContext);

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

  const displayCategories = useMemo(
    () => getDisplayCategories(categories, 'expense'),
    [categories]
  );

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este pago.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (payment) {
      setPaymentDate(new Date(payment.payment_date.replace(' ', 'T')));
      setPaidWithAccount(payment.paid_with_account);
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
    }
  }, [payment]);

  if (!payment) {
    return (
      <View style={styles.container}>
        <Text>Pago no encontrado</Text>
      </View>
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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Fecha y hora</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => canEdit && setShowDatePicker(true)}
          disabled={!canEdit}
        >
          <Text>{toMySQLDateTime(paymentDate)}</Text>
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

        <Text style={styles.label}>Cuenta utilizada</Text>
        <View style={styles.pickerWrap}>
        <Picker
          selectedValue={paidWithAccount}
          onValueChange={setPaidWithAccount}
          style={styles.picker}
        >
          <Picker.Item label="-- Selecciona cuenta --" value="" />
          {cashBoxes.map(cb => (
            <Picker.Item key={cb.id} label={cb.name} value={cb.id.toString()} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Tipo de acreedor</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={creditorType}
          onValueChange={(val) => setCreditorType(val as any)}
          style={styles.picker}
        >
          <Picker.Item label="Cliente" value="client" />
          <Picker.Item label="Proveedor" value="provider" />
          <Picker.Item label="Otro" value="other" />
        </Picker>
      </View>

      {creditorType === 'client' && (
        <>
          <Text style={styles.label}>Cliente</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={creditorClientId}
              onValueChange={setCreditorClientId}
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

      {creditorType === 'provider' && (
        <>
          <Text style={styles.label}>Proveedor</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={creditorProviderId}
              onValueChange={setCreditorProviderId}
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

      {creditorType === 'other' && (
        <>
          <Text style={styles.label}>Acreedor</Text>
          <TextInput
            style={styles.input}
            value={creditorOther}
            onChangeText={setCreditorOther}
            placeholder="Nombre del acreedor"
          />
        </>
      )}

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        editable={canEdit}
      />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={categoryId}
          onValueChange={setCategoryId}
          style={styles.picker}
          enabled={canEdit}
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
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        editable={canEdit}
      />

      <View style={styles.switchRow}>
        <Text>Cobrar al cliente</Text>
        <Switch value={chargeClient} onValueChange={setChargeClient} disabled={!canEdit} />
      </View>

      {chargeClient && (
        <>
          <Text style={styles.label}>Cliente a cobrar</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={chargeClientId}
              onValueChange={setChargeClientId}
              style={styles.picker}
              enabled={canEdit}
            >
              <Picker.Item label="-- Selecciona cliente --" value="" />
              {clients.map(c => (
                <Picker.Item key={c.id} label={c.business_name} value={c.id.toString()} />
              ))}
            </Picker>
          </View>
        </>
      )}

      <FileCarousel filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} />

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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  picker: { height: 50, width: '100%' },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#007bff',
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
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});

