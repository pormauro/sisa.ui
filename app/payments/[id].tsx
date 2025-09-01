// app/payments/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { PaymentsContext } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function PaymentDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updatePayment');
  const canDelete = permissions.includes('deletePayment');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Number(id);
  const { payments, updatePayment, deletePayment } = useContext(PaymentsContext);

  const payment = payments.find(p => p.id === paymentId);

  const [paidWithAccount, setPaidWithAccount] = useState('');
  const [creditorType, setCreditorType] = useState<'client' | 'provider' | 'other'>('other');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [chargeClient, setChargeClient] = useState(false);
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
      setDescription(payment.description || '');
      if (payment.items && payment.items[0]) {
        setCategoryId(String(payment.items[0].category_id));
        setPrice(String(payment.items[0].price));
        setChargeClient(payment.items[0].charge_client);
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
            description,
            items: [
              {
                category_id: parseInt(categoryId, 10),
                price: parseFloat(price),
                charge_client: chargeClient,
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
      <TextInput style={styles.input} value={paidWithAccount} onChangeText={setPaidWithAccount} />

      <Text style={styles.label}>Tipo de acreedor</Text>
      <TextInput style={styles.input} value={creditorType} onChangeText={(t) => setCreditorType(t as any)} />

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} />

      <Text style={styles.label}>ID Categoría</Text>
      <TextInput style={styles.input} value={categoryId} onChangeText={setCategoryId} keyboardType="numeric" />

      <Text style={styles.label}>Precio</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />

      <View style={styles.switchRow}>
        <Text>Cobrar al cliente</Text>
        <Switch value={chargeClient} onValueChange={setChargeClient} />
      </View>

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
  submitButton: { marginTop: 16, backgroundColor: '#007bff', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
