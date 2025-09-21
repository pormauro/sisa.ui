// Archivo: app/folders/[id].tsx

import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { FoldersContext, Folder } from '@/contexts/FoldersContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS, type SelectionKey } from '@/constants/selectionKeys';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function FolderDetailPage() {
  const router = useRouter();
  const { id, selection_key } = useLocalSearchParams<{
    id: string | string[];
    selection_key?: string | string[];
  }>();
  const idParam = Array.isArray(id) ? id[0] : id;
  const selectionKeyParam = Array.isArray(selection_key) ? selection_key[0] : selection_key;
  const folderId = idParam ? Number(idParam) : NaN;
  const { folders, loadFolders, updateFolder, deleteFolder } = useContext(FoldersContext);
  const { clients } = useContext(ClientsContext);
  const { permissions } = useContext(PermissionsContext);
  const { activeKey, beginSelection, completeSelection, cancelSelection } = usePendingSelection();

  const folder = folders.find(f => f.id === folderId);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [folderImageFileId, setFolderImageFileId] = useState<string | null>(null);
  const [selectingParent, setSelectingParent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const deleteButtonColor = useThemeColor({ light: '#dc3545', dark: '#92272f' }, 'background');
  const deleteButtonTextColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');
  const modalItemHighlight = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#ddd', dark: '#555' }, 'background');
  const cancelButtonColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const cancelTextColor = useThemeColor({}, 'text');
  const spinnerColor = useThemeColor({}, 'tint');

  const canEdit = permissions.includes('updateFolder');
  const canDelete = permissions.includes('deleteFolder');

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver esta carpeta.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (!selectionKeyParam) {
      return;
    }
    const groups = Object.values(SELECTION_KEYS) as Record<string, SelectionKey>[];
    const match = groups
      .flatMap(group => Object.values(group) as SelectionKey[])
      .find(key => key === selectionKeyParam);
    if (match && activeKey !== match) {
      beginSelection(match);
    }
  }, [selectionKeyParam, beginSelection, activeKey]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);

  useEffect(() => {
    if (folder) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setName(folder.name);
      setParentId(folder.parent_id);
      setFolderImageFileId(folder.folder_image_file_id);
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadFolders()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [folder, hasAttemptedLoad, isFetchingItem, loadFolders]);

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

  if (!folder) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}> 
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={spinnerColor} />
        ) : (
          <ThemedText>Carpeta no encontrada</ThemedText>
        )}
      </ThemedView>
    );
  }

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
            if (!Number.isNaN(folderId)) {
              completeSelection(folderId.toString());
            }
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

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}> 
      <ThemedText style={styles.label}>Imagen de la carpeta</ThemedText>
      <CircleImagePicker fileId={folderImageFileId} editable={true} size={200} onImageChange={setFolderImageFileId} />

      <ThemedText style={styles.label}>Nombre de la carpeta</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={name}
        onChangeText={setName}
      />

      <ThemedText style={styles.label}>Ubicación</ThemedText>
      <TouchableOpacity style={[styles.input, { backgroundColor: inputBackground, borderColor }]} onPress={() => setSelectingParent(true)}>
        <ThemedText style={{ color: inputTextColor }}>{getFolderPath(parentId)}</ThemedText>
      </TouchableOpacity>

      <Modal visible={selectingParent} animationType="slide">
        <ThemedView style={[styles.modalContainer, { backgroundColor: screenBackground }]}> 
          <ThemedText style={styles.label}>Selecciona carpeta padre</ThemedText>
          <FlatList
            data={folderTree}
            keyExtractor={(item) => `folder-${item.id}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.item, { borderColor: itemBorderColor }, item.id === null && { backgroundColor: modalItemHighlight }]}
                onPress={() => {
                  setParentId(item.id);
                  setSelectingParent(false);
                }}>
                <ThemedText>
                  {'     '.repeat(item.level)}{item.id === null ? clientName : `─ ${item.name}`}
                </ThemedText>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity onPress={() => setSelectingParent(false)} style={[styles.cancelButton, { backgroundColor: cancelButtonColor }]}>
            <ThemedText style={[styles.cancelText, { color: cancelTextColor }]}>Cancelar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </Modal>

      {canEdit && (
        <TouchableOpacity style={[styles.submitButton, { backgroundColor: buttonColor }]} onPress={handleUpdate}>
          {loading ? <ActivityIndicator color={spinnerColor} /> : <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar Carpeta</ThemedText>}
        </TouchableOpacity>
      )}

      {canDelete && (
        <TouchableOpacity style={[styles.deleteButton, { backgroundColor: deleteButtonColor }]} onPress={handleDelete}>
          {loading ? <ActivityIndicator color={spinnerColor} /> : <ThemedText style={[styles.deleteButtonText, { color: deleteButtonTextColor }]}>Eliminar Carpeta</ThemedText>}
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
  deleteButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { fontSize: 16, fontWeight: 'bold' },
  modalContainer: { flex: 1, padding: 16 },
  item: { padding: 12, borderBottomWidth: 1 },
  cancelButton: { marginTop: 20, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelText: { fontWeight: 'bold' },
});
