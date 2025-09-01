// app/receipts/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { ReceiptsContext } from '@/contexts/ReceiptsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function ReceiptDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updateReceipt');
  const canDelete = permissions.includes('deleteReceipt');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(id);
  const { receipts, updateReceipt, deleteReceipt } = useContext(ReceiptsContext);

  const receipt = receipts.find(r => r.id === receiptId);

  const [paidInAccount, setPaidInAccount] = useState('');
  const [payerType, setPayerType] = useState<'client' | 'provider' | 'other'>('client');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [payProvider, setPayProvider] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este recibo.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (receipt) {
      setPaidInAccount(receipt.paid_in_account);
      setPayerType(receipt.payer_type);
      setDescription(receipt.description || '');
      if (receipt.items[0]) {
        setCategoryId(String(receipt.items[0].category_id));
        setPrice(String(receipt.items[0].price));
        setPayProvider(receipt.items[0].pay_provider);
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
            paid_in_account: paidInAccount,
            payer_type: payerType,
            description,
            items: [{ category_id: parseInt(categoryId, 10), price: parseFloat(price), pay_provider: payProvider }],
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
      <Text style={styles.label}>Cuenta de ingreso</Text>
      <TextInput style={styles.input} value={paidInAccount} onChangeText={setPaidInAccount} />

      <Text style={styles.label}>Tipo de pagador</Text>
      <TextInput style={styles.input} value={payerType} onChangeText={(t) => setPayerType(t as any)} />

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} />

      <Text style={styles.label}>ID Categoría</Text>
      <TextInput style={styles.input} value={categoryId} onChangeText={setCategoryId} keyboardType="numeric" />

      <Text style={styles.label}>Precio</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />

      <View style={styles.switchRow}>
        <Text>Pagar al proveedor</Text>
        <Switch value={payProvider} onValueChange={setPayProvider} />
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
