// app/providers/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';

export default function CreateProvider() {
  const router = useRouter();
  const { addProvider } = useContext(ProvidersContext);
  const { permissions } = useContext(PermissionsContext);
  const { completeSelection, cancelSelection } = usePendingSelection();

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [brandFileId, setBrandFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addProvider')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar proveedores.');
      router.back();
    }
  }, [permissions]);

  useEffect(
    () => () => {
      cancelSelection();
    },
    [cancelSelection]
  );

  const handleSubmit = async () => {
    if (!businessName) {
      Alert.alert('Error', 'La razón social es obligatoria.');
      return;
    }
    setLoading(true);
    const newProvider = await addProvider({
      business_name: businessName,
      ...(taxId ? { tax_id: taxId } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
      ...(brandFileId ? { brand_file_id: brandFileId } : {}),
    });
    setLoading(false);
    if (newProvider) {
      Alert.alert('Éxito', 'Proveedor creado.');
      completeSelection(newProvider.id.toString());
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el proveedor.');
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
      <ThemedText style={styles.label}>Imagen del Proveedor</ThemedText>
      <CircleImagePicker
        fileId={brandFileId}
        editable={true}
        size={200}
        onImageChange={setBrandFileId}
      />

      <ThemedText style={styles.label}>Razón Social</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Nombre"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>CUIT</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={taxId}
        onChangeText={setTaxId}
        placeholder="CUIT"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Email</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Teléfono</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={phone}
        onChangeText={setPhone}
        placeholder="Teléfono"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Dirección</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={address}
        onChangeText={setAddress}
        placeholder="Dirección"
        placeholderTextColor={placeholderColor}
      />

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear Proveedor</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
