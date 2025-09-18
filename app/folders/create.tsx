import React, { useState, useContext, useEffect } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { FoldersContext } from '@/contexts/FoldersContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CreateFolderPage() {
  const router = useRouter();
  const { client_id, parent_id } = useLocalSearchParams<{ client_id?: string; parent_id?: string }>();
  const { permissions } = useContext(PermissionsContext);
  const { addFolder, folders } = useContext(FoldersContext);
  const { clients, loadClients } = useContext(ClientsContext);

  const parentId = parent_id ? Number(parent_id) : null;
  const folderParent = parentId ? folders.find(f => f.id === parentId) : null;
  const resolvedClientId = client_id ? Number(client_id) : folderParent ? folderParent.client_id : null;
  const [clientId, setClientId] = useState<number | null>(resolvedClientId);
  const isClientFixed = parentId !== null || !!client_id;

  const NEW_CLIENT_VALUE = '__NEW_CLIENT__';

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const [name, setName] = useState('');
  const [folderImageFileId, setFolderImageFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addFolder')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear carpetas.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (!clients.length) {
      loadClients();
    }
  }, [clients.length, loadClients]);

  useEffect(() => {
    if (resolvedClientId !== null) {
      setClientId(resolvedClientId);
    }
  }, [resolvedClientId]);

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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
      <ThemedText style={styles.label}>Cliente *</ThemedText>
      <View style={[styles.pickerWrapper, { backgroundColor: inputBackground, borderColor }]}> 
        <Picker
          selectedValue={clientId !== null ? clientId.toString() : ''}
          onValueChange={(value) => {
            if (value === NEW_CLIENT_VALUE) {
              if (clientId !== null) {
                setClientId(null);
              }
              router.push('/clients/create');
              return;
            }
            setClientId(value ? Number(value) : null);
          }}
          enabled={!isClientFixed}
          dropdownIconColor={inputTextColor}
          style={[styles.picker, { color: inputTextColor }]}
        >
          <Picker.Item label="Selecciona un cliente" value="" color={placeholderColor} />
          <Picker.Item label="➕ Nuevo cliente" value={NEW_CLIENT_VALUE} />
          {clients.map(client => (
            <Picker.Item key={client.id} label={client.business_name} value={client.id.toString()} />
          ))}
        </Picker>
      </View>

      <ThemedText style={styles.label}>Imagen de la carpeta</ThemedText>
      <CircleImagePicker fileId={folderImageFileId} editable={true} size={200} onImageChange={setFolderImageFileId} />

      <ThemedText style={styles.label}>Nombre de la carpeta</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Nombre"
        value={name}
        onChangeText={setName}
        placeholderTextColor={placeholderColor}
      />

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>
          {loading ? 'Creando...' : 'Crear Carpeta'}
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  pickerWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
