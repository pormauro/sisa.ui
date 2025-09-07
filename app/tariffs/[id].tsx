// app/tariffs/[id].tsx
import React, { useState, useContext, useEffect } from 'react';
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TariffsContext } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function EditTariff() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tariffId = Number(id);
  const { tariffs, updateTariff, deleteTariff } = useContext(TariffsContext);
  const { permissions } = useContext(PermissionsContext);

  const tariff = tariffs.find(t => t.id === tariffId);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const canEdit = permissions.includes('updateTariff');
  const canDelete = permissions.includes('deleteTariff');

  useEffect(() => {
    if (!tariff) {
      Alert.alert('Error', 'Tarifa no encontrada.');
      router.back();
      return;
    }
    setName(tariff.name);
    setAmount(String(tariff.amount));
  }, [tariff, router]);

  const handleSubmit = async () => {
    if (!canEdit) {
      Alert.alert('Acceso denegado', 'No tienes permiso para actualizar tarifas.');
      return;
    }
    if (!name || !amount) {
      Alert.alert('Error', 'Completa todos los campos.');
      return;
    }
    setLoading(true);
    const success = await updateTariff(tariffId, { name, amount: parseFloat(amount) });
    setLoading(false);
    if (success) {
      Alert.alert('Éxito', 'Tarifa actualizada.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo actualizar la tarifa.');
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    Alert.alert('Eliminar', '¿Deseas eliminar esta tarifa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteTariff(tariffId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Tarifa eliminada.');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar la tarifa.');
          }
        },
      },
    ]);
  };

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const deleteButtonColor = useThemeColor({ light: '#dc3545', dark: '#ff6b6b' }, 'button');

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        value={name}
        onChangeText={setName}
        editable={canEdit}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Monto</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        editable={canEdit}
        placeholderTextColor={placeholderColor}
      />

      {canEdit && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Guardar Cambios</ThemedText>
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
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.deleteButtonText, { color: buttonTextColor }]}>Eliminar</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { fontSize: 16, fontWeight: 'bold' },
});
