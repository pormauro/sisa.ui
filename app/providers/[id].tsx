// app/providers/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function ProviderDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updateProvider');
  const canDelete = permissions.includes('deleteProvider');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = Number(id);
  const { providers, updateProvider, deleteProvider } = useContext(ProvidersContext);

  const provider = providers.find(p => p.id === providerId);

  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [brandFileId, setBrandFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este proveedor.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (provider && !initialized) {
      setBusinessName(provider.business_name);
      setTaxId(provider.tax_id || '');
      setEmail(provider.email || '');
      setPhone(provider.phone || '');
      setAddress(provider.address || '');
      setBrandFileId(provider.brand_file_id || null);
      setInitialized(true);
    }
  }, [provider, initialized]);

  if (!provider) {
    return (
      <View style={styles.container}>
        <Text>Proveedor no encontrado</Text>
      </View>
    );
  }

  const handleUpdate = () => {
    Alert.alert('Confirmar actualización', '¿Actualizar este proveedor?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updateProvider(providerId, {
            business_name: businessName,
            ...(taxId ? { tax_id: taxId } : {}),
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            ...(address ? { address } : {}),
            ...(brandFileId ? { brand_file_id: brandFileId } : {}),
          });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Proveedor actualizado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar el proveedor');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Confirmar eliminación', '¿Eliminar este proveedor?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteProvider(providerId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Proveedor eliminado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar el proveedor');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Imagen</Text>
      <CircleImagePicker fileId={brandFileId} editable={true} size={200} onImageChange={setBrandFileId} />

      <Text style={styles.label}>Razón Social</Text>
      <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} />

      <Text style={styles.label}>CUIT</Text>
      <TextInput style={styles.input} value={taxId} onChangeText={setTaxId} />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} />

      <Text style={styles.label}>Teléfono</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} />

      <Text style={styles.label}>Dirección</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />

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
});
