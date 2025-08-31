// /app/clients/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';


export default function ClientDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEditClient = permissions.includes('updateClient');
  const canDeleteClient = permissions.includes('deleteClient');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>(); // Cambiado aquí
  const clientId = Number(id);
  const { clients, updateClient, deleteClient } = useContext(ClientsContext);

  const client = clients.find(c => c.id === clientId);

  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [brandFileId, setBrandFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canEditClient && !canDeleteClient) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este cliente.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (client) {
      setBusinessName(client.business_name);
      setTaxId(client.tax_id);
      setEmail(client.email);
      setPhone(client.phone);
      setAddress(client.address);
      setBrandFileId(client.brand_file_id);
    }
  }, [client]);

  if (!client) {
    return (
      <View style={styles.container}>
        <Text>Cliente no encontrado</Text>
      </View>
    );
  }

  const handleUpdate = () => {
    /*if (!businessName || !taxId || !email) {
      Alert.alert('Error', 'Por favor ingresa Nombre de Negocio, Tax ID y Email');
      return;
    }*/
    Alert.alert(
      'Confirmar actualización',
      '¿Estás seguro de que deseas actualizar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Actualizar',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            const success = await updateClient(clientId, {
              business_name: businessName,
              tax_id: taxId,
              email,
              phone,
              address,
              brand_file_id: brandFileId,
            });
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Cliente actualizado');
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo actualizar el cliente');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };
  

  const handleDelete = async () => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de eliminar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: async () => {
            setLoading(true);
            const success = await deleteClient(clientId);
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Cliente eliminado');
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo eliminar el cliente');
            }
          }
        },
      ]
    );
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
      {canEditClient && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUpdate}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Actualizar Cliente</Text>}
        </TouchableOpacity>
      )}

      {canDeleteClient && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Eliminar Cliente</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginVertical: 8, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#007BFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: {
    marginTop: 16,
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
