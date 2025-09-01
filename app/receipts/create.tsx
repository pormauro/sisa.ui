// app/receipts/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { ReceiptsContext } from '@/contexts/ReceiptsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CreateReceipt() {
  const router = useRouter();
  const { addReceipt } = useContext(ReceiptsContext);
  const { permissions } = useContext(PermissionsContext);

  const [paidInAccount, setPaidInAccount] = useState('bank');
  const [payerType, setPayerType] = useState<'client' | 'provider' | 'other'>('client');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [payProvider, setPayProvider] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addReceipt')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar recibos.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!categoryId || !price) {
      Alert.alert('Error', 'Completa los campos obligatorios.');
      return;
    }
    setLoading(true);
    const newReceipt = await addReceipt({
      paid_in_account: paidInAccount,
      payer_type: payerType,
      description,
      items: [{ category_id: parseInt(categoryId, 10), price: parseFloat(price), pay_provider: payProvider }],
    });
    setLoading(false);
    if (newReceipt) {
      Alert.alert('Éxito', 'Recibo creado.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el recibo.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Cuenta de ingreso</Text>
      <TextInput style={styles.input} value={paidInAccount} onChangeText={setPaidInAccount} placeholder="Cuenta" />

      <Text style={styles.label}>Tipo de pagador (client/provider/other)</Text>
      <TextInput style={styles.input} value={payerType} onChangeText={(t) => setPayerType(t as any)} placeholder="Tipo" />

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Descripción" />

      <Text style={styles.label}>ID Categoría</Text>
      <TextInput style={styles.input} value={categoryId} onChangeText={setCategoryId} placeholder="ID" keyboardType="numeric" />

      <Text style={styles.label}>Precio</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Precio" keyboardType="numeric" />

      <View style={styles.switchRow}>
        <Text>Pagar al proveedor</Text>
        <Switch value={payProvider} onValueChange={setPayProvider} />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear Recibo</Text>}
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
