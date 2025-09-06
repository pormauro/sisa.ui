// app/payments/create.tsx
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
import FileCarousel from '@/components/FileCarousel';

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

  const displayCategories = useMemo(
    () => getDisplayCategories(categories, 'expense'),
    [categories]
  );

  useEffect(() => {
    if (!permissions.includes('addPayment')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar pagos.');
      router.back();
    }
  }, [permissions]);

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Fecha y hora</Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowDatePicker(true)}
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
        placeholder="Descripción"
      />

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
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="Precio"
        keyboardType="numeric"
      />

      <View style={styles.switchRow}>
        <Text>Cobrar al cliente</Text>
        <Switch value={chargeClient} onValueChange={setChargeClient} />
      </View>

      {chargeClient && (
        <>
          <Text style={styles.label}>Cliente a cobrar</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={chargeClientId}
              onValueChange={setChargeClientId}
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

      <FileCarousel filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} editable />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Crear Pago</Text>
        )}
      </TouchableOpacity>
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
    backgroundColor: '#28a745',
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

