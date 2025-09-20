// /app/clients/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';


export default function ClientDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEditClient = permissions.includes('updateClient');
  const canDeleteClient = permissions.includes('deleteClient');

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>(); // Cambiado aquí
  const clientId = Number(id);
  const { clients, loadClients, updateClient, deleteClient } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);

  const client = clients.find(c => c.id === clientId);

  const NEW_TARIFF_VALUE = 'new_tariff';

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
  const [tariffId, setTariffId] = useState<string>('');
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);

  const tariffItems = useMemo(
    () => [
      { label: 'Sin Tarifa', value: '' },
      { label: '➕ Nueva tarifa', value: NEW_TARIFF_VALUE },
      ...tariffs.map(t => ({ label: `${t.name} - ${t.amount}`, value: t.id.toString() })),
    ],
    [tariffs]
  );

  useEffect(() => {
    if (!canEditClient && !canDeleteClient) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este cliente.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (client) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setBusinessName(client.business_name);
      setTaxId(client.tax_id);
      setEmail(client.email);
      setPhone(client.phone);
      setAddress(client.address);
      setBrandFileId(client.brand_file_id);
      setTariffId(client.tariff_id ? client.tariff_id.toString() : '');
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadClients()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [client, hasAttemptedLoad, isFetchingItem, loadClients]);

  if (!client) {
    return (
      <View style={[styles.container, { backgroundColor: screenBackground }]}>
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={buttonColor} />
        ) : (
          <ThemedText>Cliente no encontrado</ThemedText>
        )}
      </View>
    );
  }

  const handleUpdate = () => {
    /*if (!businessName || !taxId || !email) {
      Alert.alert('Error', 'Por favor ingresa Nombre de Negocio, CUIT y Email');
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
              tariff_id: tariffId ? parseInt(tariffId, 10) : null,
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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
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
            router.push('/tariffs/create');
            return;
          }
          setTariffId(value);
        }}
        placeholder="Sin Tarifa"
        disabled={!canEditClient}
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_TARIFF_VALUE) return;
          router.push(`/tariffs/${value}`);
        }}
      />
      {canEditClient && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleUpdate}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar Cliente</ThemedText>
          )}
        </TouchableOpacity>
      )}

      {canDeleteClient && (
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: deleteButtonColor }]}
          onPress={handleDelete}
        >
          {loading ? (
            <ActivityIndicator color={deleteButtonTextColor} />
          ) : (
            <ThemedText style={[styles.deleteButtonText, { color: deleteButtonTextColor }]}>Eliminar Cliente</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
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
  deleteButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: { fontSize: 16, fontWeight: 'bold' },
});
