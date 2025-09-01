// app/payments/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { PaymentsContext } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CreatePayment() {
  const router = useRouter();
  const { addPayment } = useContext(PaymentsContext);
  const { permissions } = useContext(PermissionsContext);

  const [paidWithAccount, setPaidWithAccount] = useState('cash');
  const [creditorType, setCreditorType] = useState<'client' | 'provider' | 'other'>('other');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [chargeClient, setChargeClient] = useState(false);
  const [loading, setLoading] = useState(false);

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
      paid_with_account: paidWithAccount,
      creditor_type: creditorType,
      description,
      items: [{ category_id: parseInt(categoryId, 10), price: parseFloat(price), charge_client: chargeClient }],
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
      <Text style={styles.label}>Cuenta utilizada</Text>
      <TextInput style={styles.input} value={paidWithAccount} onChangeText={setPaidWithAccount} placeholder="Cuenta" />

      <Text style={styles.label}>Tipo de acreedor (client/provider/other)</Text>
      <TextInput style={styles.input} value={creditorType} onChangeText={(t) => setCreditorType(t as any)} placeholder="Tipo" />

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Descripción" />

      <Text style={styles.label}>ID Categoría</Text>
      <TextInput style={styles.input} value={categoryId} onChangeText={setCategoryId} placeholder="ID" keyboardType="numeric" />

      <Text style={styles.label}>Precio</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Precio" keyboardType="numeric" />

      <View style={styles.switchRow}>
        <Text>Cobrar al cliente</Text>
        <Switch value={chargeClient} onValueChange={setChargeClient} />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear Pago</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#28a745', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
