// app/providers/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function CreateProvider() {
  const router = useRouter();
  const { addProvider } = useContext(ProvidersContext);
  const { permissions } = useContext(PermissionsContext);

  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addProvider')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar proveedores.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!businessName || !taxId || !email) {
      Alert.alert('Error', 'Completa los campos obligatorios.');
      return;
    }
    setLoading(true);
    const newProvider = await addProvider({ business_name: businessName, tax_id: taxId, email, phone, address, brand_file_id: null });
    setLoading(false);
    if (newProvider) {
      Alert.alert('Éxito', 'Proveedor creado.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el proveedor.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Razón Social</Text>
      <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Nombre" />

      <Text style={styles.label}>CUIT</Text>
      <TextInput style={styles.input} value={taxId} onChangeText={setTaxId} placeholder="CUIT" />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" />

      <Text style={styles.label}>Teléfono</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Teléfono" />

      <Text style={styles.label}>Dirección</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Dirección" />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear Proveedor</Text>}
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
});
