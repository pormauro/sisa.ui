// /app/clients/create.tsx
import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { ClientsContext, ClientPayload } from '@/contexts/ClientsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CreateClientPage() {
  const { permissions } = useContext(PermissionsContext);
  const { addClient } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const router = useRouter();

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const pickerBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [brandFileId, setBrandFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tariffId, setTariffId] = useState<string>('');
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!permissions.includes('addClient')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear clientes.');
      router.back();
    }
  }, []);
  const sanitizeOptionalField = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const sanitizeBrandField = (value: string | null): string | null => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    /*  if (!businessName || !taxId || !email) {
      Alert.alert('Error', 'Por favor ingresa Nombre de Negocio, CUIT y Email');
      submittingRef.current = false;
      return;
    }*/
    setLoading(true);
    try {
      const parsedTariffId = tariffId ? Number.parseInt(tariffId, 10) : null;
      const payload: ClientPayload = {
        business_name: businessName.trim(),
        tax_id: sanitizeOptionalField(taxId),
        email: sanitizeOptionalField(email),
        phone: sanitizeOptionalField(phone),
        address: sanitizeOptionalField(address),
        brand_file_id: sanitizeBrandField(brandFileId),
        tariff_id: Number.isNaN(parsedTariffId) ? null : parsedTariffId,
      };

      const newClient = await addClient(payload);
      if (newClient) {
        Alert.alert('Éxito', 'Cliente creado exitosamente');
        router.back();
      } else {
        Alert.alert('Error', 'No se pudo crear el cliente');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el cliente');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
      <ThemedText style={styles.label}>Imagen del Cliente</ThemedText>
      <CircleImagePicker
        fileId={brandFileId}
        editable={true}
        size={200}
        onImageChange={(newFileId) => setBrandFileId(newFileId)}
      />

      <ThemedText style={styles.label}>Nombre del Negocio</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Nombre del negocio"
        value={businessName}
        onChangeText={setBusinessName}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>CUIT</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="CUIT"
        value={taxId}
        onChangeText={setTaxId}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Email</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Teléfono</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Teléfono"
        value={phone}
        onChangeText={setPhone}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Dirección</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Dirección"
        value={address}
        onChangeText={setAddress}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Tarifa</ThemedText>
      <View style={[styles.pickerWrap, { backgroundColor: pickerBackground, borderColor }]}>
        <Picker
          selectedValue={tariffId}
          onValueChange={setTariffId}
          style={[styles.picker, { color: inputTextColor }]}
        >
          <Picker.Item label="Sin Tarifa" value="" />
          {tariffs.map(t => (
            <Picker.Item key={t.id} label={`${t.name} - ${t.amount}`} value={t.id.toString()} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>
          {loading ? 'Creando...' : 'Crear Cliente'}
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: { height: 50, width: '100%' },
  submitButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
