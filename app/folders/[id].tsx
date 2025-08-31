// Archivo: app/folders/[id].tsx

import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { FoldersContext, Folder } from '@/contexts/FoldersContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';

export default function FolderDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const folderId = Number(id);
  const { folders, updateFolder, deleteFolder } = useContext(FoldersContext);
  const { clients } = useContext(ClientsContext);
  const { permissions } = useContext(PermissionsContext);

  const folder = folders.find(f => f.id === folderId);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [folderImageFileId, setFolderImageFileId] = useState<string | null>(null);
  const [selectingParent, setSelectingParent] = useState(false);
  const [loading, setLoading] = useState(false);

  const canEdit = permissions.includes('updateFolder');
  const canDelete = permissions.includes('deleteFolder');

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver esta carpeta.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setParentId(folder.parent_id);
      setFolderImageFileId(folder.folder_image_file_id);
    }
  }, [folder]);

  const clientName = clients.find(c => c.id === folder?.client_id)?.business_name || 'Cliente';

  const buildFolderTree = (parentId: number | null, level = 0): any[] => {
    return folders
      .filter(f => f.parent_id === parentId && f.client_id === folder?.client_id && f.id !== folderId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap(f => [
        { ...f, level },
        ...buildFolderTree(f.id, level + 1)
      ]);
  };

  const getFolderPath = (id: number | null): string => {
    if (!id) return clientName;
    const stack: string[] = [];
    let current = folders.find(f => f.id === id);
    while (current) {
      stack.unshift(current.name);
      if (!current.parent_id) break;
      current = folders.find(f => f.id === current?.parent_id);
    }
    return `${clientName}/${stack.join('/')}`;
  };

  const handleUpdate = () => {
    if (!folder) return;
    Alert.alert('Actualizar', '¿Actualizar esta carpeta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updateFolder(folderId, {
            name,
            client_id: folder.client_id,
            parent_id: parentId,
            folder_image_file_id: folderImageFileId,
          });
          setLoading(false);
          if (success) {
            Alert.alert('Actualizado', 'Carpeta actualizada correctamente');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Eliminar', '¿Eliminar esta carpeta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteFolder(folderId);
          setLoading(false);
          if (success) {
            Alert.alert('Eliminado', 'Carpeta eliminada');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const folderTree = [{ id: null, name: clientName, level: 0 }, ...buildFolderTree(null, 1)];

  if (!folder)
    return (
      <View style={styles.container}>
        <Text>Carpeta no encontrada</Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Imagen de la carpeta</Text>
      <CircleImagePicker fileId={folderImageFileId} editable={true} size={200} onImageChange={setFolderImageFileId} />

      <Text style={styles.label}>Nombre de la carpeta</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Ubicación</Text>
      <TouchableOpacity style={styles.input} onPress={() => setSelectingParent(true)}>
        <Text>{getFolderPath(parentId)}</Text>
      </TouchableOpacity>

      <Modal visible={selectingParent} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.label}>Selecciona carpeta padre</Text>
          <FlatList
            data={folderTree}
            keyExtractor={(item) => `folder-${item.id}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.item, item.id === null && { backgroundColor: '#eee' }]}
                onPress={() => {
                  setParentId(item.id);
                  setSelectingParent(false);
                }}>
                <Text>{'     '.repeat(item.level)}{item.id === null ? clientName : `─ ${item.name}`}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity onPress={() => setSelectingParent(false)} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {canEdit && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUpdate}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Actualizar Carpeta</Text>}
        </TouchableOpacity>
      )}

      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Eliminar Carpeta</Text>}
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
  modalContainer: { flex: 1, padding: 16, backgroundColor: '#fff' },
  item: { padding: 12, borderBottomWidth: 1, borderColor: '#ddd' },
  cancelButton: { marginTop: 20, padding: 12, backgroundColor: '#ccc', borderRadius: 8, alignItems: 'center' },
  cancelText: { fontWeight: 'bold' },
});
