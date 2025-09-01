// app/payments/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect } from 'react';
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

  const [paidWithAccount, setPaidWithAccount] = useState('');
  const [creditorType, setCreditorType] = useState<'client' | 'provider' | 'other'>('other');
  const [creditorClientId, setCreditorClientId] = useState('');
  const [creditorProviderId, setCreditorProviderId] = useState('');
  const [creditorOther, setCreditorOther] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [chargeClient, setChargeClient] = useState(false);
  const [chargeClientId, setChargeClientId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este pago.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (payment) {
      setPaidWithAccount(payment.paid_with_account);
      setCreditorType(payment.creditor_type);
      setCreditorClientId(payment.creditor_client_id ? String(payment.creditor_client_id) : '');
      setCreditorProviderId(payment.creditor_provider_id ? String(payment.creditor_provider_id) : '');
      setCreditorOther(payment.creditor_other || '');
      setDescription(payment.description || '');
      if (payment.items && payment.items[0]) {
        setCategoryId(String(payment.items[0].category_id));
        setPrice(String(payment.items[0].price));
        setChargeClient(payment.items[0].charge_client);
        setChargeClientId(payment.items[0].client_id ? String(payment.items[0].client_id) : '');
      }
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
            items: [
              {
                category_id: parseInt(categoryId, 10),
                price: parseFloat(price),
                charge_client: chargeClient,
                client_id:
                  chargeClient && chargeClientId
                    ? parseInt(chargeClientId, 10)
                    : null,
              },
            ],
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
          {categories.map(c => (
            <Picker.Item key={c.id} label={c.name} value={c.id.toString()} />
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

