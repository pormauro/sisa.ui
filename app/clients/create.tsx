// /app/clients/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { ClientsContext } from '@/contexts/ClientsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { TariffsContext } from '@/contexts/TariffsContext';

export default function CreateClientPage() {
  const { permissions } = useContext(PermissionsContext);
  const { addClient } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const router = useRouter();

  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [brandFileId, setBrandFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tariffId, setTariffId] = useState<string>('');

  useEffect(() => {
    if (!permissions.includes('addClient')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear clientes.');
      router.back();
    }
  }, []);
  const handleSubmit = async () => {
  /*  if (!businessName || !taxId || !email) {
      Alert.alert('Error', 'Por favor ingresa Nombre de Negocio, Tax ID y Email');
      return;
    }*/
    setLoading(true);
    const newClient = await addClient({
      business_name: businessName,
      tax_id: taxId,
      email,
      phone,
      address,
      brand_file_id: brandFileId,
      tariff_id: tariffId ? parseInt(tariffId, 10) : null,
    });
    setLoading(false);
    if (newClient) {
      Alert.alert('Éxito', 'Cliente creado exitosamente');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el cliente');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Imagen del Cliente</Text>
      <CircleImagePicker 
        fileId={brandFileId} 
        editable={true}
        size={200} 
        onImageChange={(newFileId) => setBrandFileId(newFileId)} 
      />

      <Text style={styles.label}>Nombre del Negocio</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre del negocio"
        value={businessName}
        onChangeText={setBusinessName}
      />

      <Text style={styles.label}>Tax ID</Text>
      <TextInput
        style={styles.input}
        placeholder="Tax ID"
        value={taxId}
        onChangeText={setTaxId}
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        placeholder="Teléfono"
        value={phone}
        onChangeText={setPhone}
      />

      <Text style={styles.label}>Dirección</Text>
      <TextInput
        style={styles.input}
        placeholder="Dirección"
        value={address}
        onChangeText={setAddress}
      />

      <Text style={styles.label}>Tarifa</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={tariffId}
          onValueChange={setTariffId}
          style={styles.picker}
        >
          <Picker.Item label="Sin Tarifa" value="" />
          {tariffs.map(t => (
            <Picker.Item key={t.id} label={`${t.name} - ${t.amount}`} value={t.id.toString()} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.submitButtonText}>{loading ? 'Creando...' : 'Crear Cliente'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
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
});
