// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/[id].tsx
import React, { useState, useContext, useEffect } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CashBoxesContext, CashBox } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CashBoxDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cashBoxId = Number(id);
  const { cashBoxes, updateCashBox, deleteCashBox } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const [name, setName] = useState('');
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const canEdit = permissions.includes('updateCashBox');
  const canDelete = permissions.includes('deleteCashBox');

  const cashBox = cashBoxes.find(cb => cb.id === cashBoxId);

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a esta caja.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (!cashBox) {
      Alert.alert('Error', 'Caja no encontrada');
      router.back();
    } else {
      setName(cashBox.name);
      setImageFileId(cashBox.image_file_id);
    }
  }, [cashBox]);

  const handleUpdate = () => {
    if (!name) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    Alert.alert(
      'Actualizar',
      '¿Actualizar esta caja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Actualizar',
          onPress: async () => {
            setLoading(true);
            const success = await updateCashBox(cashBoxId, { name, image_file_id: imageFileId });
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Caja actualizada');
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo actualizar la caja');
            }
          }
        }
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar',
      '¿Eliminar esta caja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          onPress: async () => {
            setLoading(true);
            const success = await deleteCashBox(cashBoxId);
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Caja eliminada');
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo eliminar la caja');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
      <ThemedText style={styles.label}>Imagen de la Caja</ThemedText>
      <CircleImagePicker
        fileId={imageFileId}
        editable={true}
        size={200}
        onImageChange={(newId) => setImageFileId(newId)}
      />

      <ThemedText style={styles.label}>Nombre de la Caja</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={name}
        onChangeText={setName}
        placeholder="Nombre de la caja"
        placeholderTextColor={placeholderColor}
      />

      {canEdit && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleUpdate}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar Caja</ThemedText>
          )}
        </TouchableOpacity>
      )}

      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.deleteButtonText}>Eliminar Caja</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
