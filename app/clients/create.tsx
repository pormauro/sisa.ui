// /app/clients/create.tsx
import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ClientsContext } from '@/contexts/ClientsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';

export default function CreateClientPage() {
  const { permissions } = useContext(PermissionsContext);
  const { addClient } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const router = useRouter();
  const {
    beginSelection,
    completeSelection,
    cancelSelection,
    consumeSelection,
    pendingSelections,
  } = usePendingSelection();

  const NEW_TARIFF_VALUE = 'new_tariff';

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
  const [tariffId, setTariffId] = useState<string>('');
  const submittingRef = useRef(false);

  const tariffItems = useMemo(
    () => [
      { label: 'Sin Tarifa', value: '' },
      { label: '➕ Nueva tarifa', value: NEW_TARIFF_VALUE },
      ...tariffs.map(t => ({ label: `${t.name} - ${t.amount}`, value: t.id.toString() })),
    ],
    [tariffs]
  );

  useEffect(() => {
    if (!permissions.includes('addClient')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear clientes.');
      router.back();
    }
  }, []);

  useEffect(() => {
    if (
      !Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.clients.tariff)
    ) {
      return;
    }
    const pendingTariffId = consumeSelection<string>(SELECTION_KEYS.clients.tariff);
    if (!pendingTariffId) {
      return;
    }
    const exists = tariffs.some(tariff => tariff.id.toString() === pendingTariffId);
    if (!exists) {
      return;
    }
    setTariffId(pendingTariffId);
  }, [pendingSelections, consumeSelection, tariffs]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);
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
      const newClient = await addClient({
        business_name: businessName,
        tax_id: taxId,
        email,
        phone,
        address,
        brand_file_id: brandFileId,
        tariff_id: tariffId ? parseInt(tariffId, 10) : null,
      });
      if (newClient) {
        Alert.alert('Éxito', 'Cliente creado exitosamente');
        completeSelection(newClient.id.toString());
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
      keyboardDismissMode="on-drag"
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
      <SearchableSelect
        style={styles.select}
        items={tariffItems}
        selectedValue={tariffId}
        onValueChange={(itemValue) => {
          const value = itemValue?.toString() ?? '';
          if (value === NEW_TARIFF_VALUE) {
            setTariffId('');
            beginSelection(SELECTION_KEYS.clients.tariff);
            router.push('/tariffs/create');
            return;
          }
          setTariffId(value);
        }}
        placeholder="Sin Tarifa"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_TARIFF_VALUE) return;
          beginSelection(SELECTION_KEYS.clients.tariff);
          router.push(`/tariffs/${value}`);
        }}
      />

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
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  select: {
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
