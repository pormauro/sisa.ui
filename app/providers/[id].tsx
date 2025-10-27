// app/providers/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';

export default function ProviderDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updateProvider');
  const canDelete = permissions.includes('deleteProvider');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = Number(id);
  const { providers, loadProviders, updateProvider, deleteProvider } = useContext(ProvidersContext);
  const { completeSelection, cancelSelection } = usePendingSelection();

  const provider = providers.find(p => p.id === providerId);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const deleteButtonColor = useThemeColor({ light: '#dc3545', dark: '#92272f' }, 'background');
  const deleteButtonTextColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');

  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [brandFileId, setBrandFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este proveedor.');
      router.back();
    }
  }, [permissions]);

  useEffect(
    () => () => {
      cancelSelection();
    },
    [cancelSelection]
  );

  useEffect(() => {
    if (provider) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setBusinessName(provider.business_name);
      setTaxId(provider.tax_id || '');
      setEmail(provider.email || '');
      setPhone(provider.phone || '');
      setAddress(provider.address || '');
      setBrandFileId(provider.brand_file_id || null);
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadProviders()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [provider, hasAttemptedLoad, isFetchingItem, loadProviders]);

  if (!provider) {
    return (
      <View style={[styles.container, { backgroundColor: screenBackground }]}>
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={buttonColor} />
        ) : (
          <ThemedText>Proveedor no encontrado</ThemedText>
        )}
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
            brand_file_id: brandFileId ?? null,
          });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Proveedor actualizado');
            completeSelection(providerId.toString());
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
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
      <ThemedText style={styles.label}>Imagen</ThemedText>
      <CircleImagePicker fileId={brandFileId} editable={true} size={200} onImageChange={setBrandFileId} />

      <ThemedText style={styles.label}>Razón Social</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={businessName}
        onChangeText={setBusinessName}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>CUIT</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={taxId}
        onChangeText={setTaxId}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Email</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={email}
        onChangeText={setEmail}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Teléfono</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={phone}
        onChangeText={setPhone}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Dirección</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={address}
        onChangeText={setAddress}
        placeholderTextColor={placeholderColor}
      />

      {canEdit && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar</ThemedText>
          )}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: deleteButtonColor }]}
          onPress={handleDelete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={deleteButtonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: deleteButtonTextColor }]}>Eliminar</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
