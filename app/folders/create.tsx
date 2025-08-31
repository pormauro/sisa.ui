import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FoldersContext } from '@/contexts/FoldersContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';

export default function CreateFolderPage() {
  const router = useRouter();
  const { client_id, parent_id } = useLocalSearchParams<{ client_id?: string; parent_id?: string }>();
  const { permissions } = useContext(PermissionsContext);
  const { addFolder, folders } = useContext(FoldersContext);

  const parentId = parent_id ? Number(parent_id) : null;
  const folderParent = parentId ? folders.find(f => f.id === parentId) : null;
  const [clientId] = useState<number | null>(
    client_id ? Number(client_id) : folderParent ? folderParent.client_id : null
  );

  const [name, setName] = useState('');
  const [folderImageFileId, setFolderImageFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addFolder')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear carpetas.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!name || !clientId) {
      Alert.alert('Error', 'Faltan campos requeridos: nombre y cliente.');
      return;
    }
    setLoading(true);
    const success = await addFolder({
      name,
      client_id: clientId,
      parent_id: parentId,
      folder_image_file_id: folderImageFileId,
    });
    setLoading(false);
    if (success) {
      Alert.alert('Éxito', 'Carpeta creada exitosamente');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear la carpeta');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Imagen de la carpeta</Text>
      <CircleImagePicker fileId={folderImageFileId} editable={true} size={200} onImageChange={setFolderImageFileId} />

      <Text style={styles.label}>Nombre de la carpeta</Text>
      <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.submitButtonText}>{loading ? 'Creando...' : 'Crear Carpeta'}</Text>
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
