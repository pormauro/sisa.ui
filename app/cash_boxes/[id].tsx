// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/[id].tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CashBoxesContext, CashBox } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';

export default function CashBoxDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cashBoxId = Number(id);
  const { cashBoxes, updateCashBox, deleteCashBox } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const [name, setName] = useState('');
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Imagen de la Caja</Text>
      <CircleImagePicker 
        fileId={imageFileId} 
        editable={true}
        size={200} 
        onImageChange={(newId) => setImageFileId(newId)}
      />

      <Text style={styles.label}>Nombre de la Caja</Text>
      <TextInput 
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      {canEdit && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUpdate}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Actualizar Caja</Text>}
        </TouchableOpacity>
      )}

      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Eliminar Caja</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#007BFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
