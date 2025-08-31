// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';

export default function CreateCashBox() {
  const router = useRouter();
  const { addCashBox, loadCashBoxes } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  
  const [name, setName] = useState('');
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addCashBox')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear cajas.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!name) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    setLoading(true);
    const newCashBox = await addCashBox({ name, image_file_id: imageFileId });
    await loadCashBoxes();
    setLoading(false);
    if (newCashBox) {
      Alert.alert('Éxito', 'Caja creada exitosamente');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear la caja');
    }
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
        placeholder="Nombre de la caja"
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear Caja</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#28a745', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
