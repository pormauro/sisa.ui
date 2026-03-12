import React, { useState, useContext, useEffect, useMemo } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, View } from 'react-native';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FoldersContext } from '@/contexts/FoldersContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS, type SelectionKey } from '@/constants/selectionKeys';
import { getDisplayFolders } from '@/utils/folders';

export default function CreateFolderPage() {
  const router = useRouter();
  const { client_id, parent_id, selection_key } = useLocalSearchParams<{
    client_id?: string | string[];
    parent_id?: string | string[];
    selection_key?: string | string[];
  }>();
  const { permissions } = useContext(PermissionsContext);
  const { addFolder, folders } = useContext(FoldersContext);
  const { clients, loadClients } = useContext(ClientsContext);
  const {
    activeKey,
    beginSelection,
    consumeSelection,
    pendingSelections,
    completeSelection,
    cancelSelection,
  } = usePendingSelection();

  const clientIdParam = Array.isArray(client_id) ? client_id[0] : client_id;
  const parentIdParam = Array.isArray(parent_id) ? parent_id[0] : parent_id;
  const selectionKeyParam = Array.isArray(selection_key) ? selection_key[0] : selection_key;

  const parsedParentId =
    parentIdParam != null && parentIdParam !== '' ? Number(parentIdParam) : null;
  const initialParentId =
    parsedParentId != null && !Number.isNaN(parsedParentId) ? parsedParentId : null;
  const [parentId, setParentId] = useState<number | null>(initialParentId);
  const folderParent = parentId ? folders.find(f => f.id === parentId) : null;
  const parsedClientId =
    clientIdParam != null && clientIdParam !== '' ? Number(clientIdParam) : null;
  const resolvedClientId =
    parsedClientId != null && !Number.isNaN(parsedClientId)
      ? parsedClientId
      : folderParent
        ? folderParent.client_id
        : null;
  const [clientId, setClientId] = useState<number | null>(resolvedClientId);
  const isParentFixed = initialParentId !== null;
  const isClientFixed = isParentFixed || !!clientIdParam;

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

  const clientItems = useMemo(
    () => [
      { label: 'Selecciona un cliente', value: '' },
      { label: '➕ Nuevo cliente', value: NEW_CLIENT_VALUE },
      ...clients.map(client => ({ label: client.business_name, value: client.id.toString() })),
    ],
    [clients]
  );

  const parentItems = useMemo(() => {
    if (clientId === null) {
      return [{ label: 'Sin carpeta padre', value: '' }];
    }

    const clientFolders = folders.filter(folder => folder.client_id === clientId);
    const foldersMap = new Map(clientFolders.map(folder => [folder.id, folder]));

    const getFolderPathLabel = (folderId: number): string => {
      const parts: string[] = [];
      const visited = new Set<number>();
      let currentId: number | null = folderId;

      while (currentId != null && !visited.has(currentId)) {
        visited.add(currentId);
        const currentFolder = foldersMap.get(currentId);
        if (!currentFolder) {
          break;
        }
        parts.unshift(currentFolder.name);
        currentId = currentFolder.parent_id;
      }

      return parts.join(' → ');
    };

    return [
      { label: 'Sin carpeta padre', value: '' },
      ...getDisplayFolders(folders, clientId).map(folder => ({
        label: getFolderPathLabel(folder.id),
        value: folder.id.toString(),
      })),
    ];
  }, [folders, clientId]);

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
    if (resolvedClientId !== null) {
      setClientId(resolvedClientId);
    }
  }, [resolvedClientId]);

  useEffect(() => {
    if (initialParentId !== null) {
      setParentId(initialParentId);
    }
  }, [initialParentId]);

  useEffect(() => {
    if (parentId === null) {
      return;
    }

    const selectedParent = folders.find(folder => folder.id === parentId);
    if (!selectedParent) {
      return;
    }

    if (clientId !== selectedParent.client_id) {
      setClientId(selectedParent.client_id);
    }
  }, [parentId, folders, clientId]);

  useEffect(() => {
    if (isParentFixed || clientId === null || parentId === null) {
      return;
    }

    const parentBelongsToClient = folders.some(
      folder => folder.id === parentId && folder.client_id === clientId
    );
    if (!parentBelongsToClient) {
      setParentId(null);
    }
  }, [isParentFixed, clientId, parentId, folders]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.folders.client)) {
      return;
    }
    const pendingClientId = consumeSelection<string>(SELECTION_KEYS.folders.client);
    if (pendingClientId) {
      setClientId(Number(pendingClientId));
    }
  }, [pendingSelections, consumeSelection]);

  const handleSubmit = async () => {
    if (!name || !clientId) {
      Alert.alert('Error', 'Faltan campos requeridos: nombre y cliente.');
      return;
    }
    setLoading(true);
    const newFolderId = await addFolder({
      name,
      client_id: clientId,
      parent_id: parentId,
      folder_image_file_id: folderImageFileId,
    });
    setLoading(false);
    if (newFolderId != null) {
      Alert.alert('Éxito', 'Carpeta creada exitosamente');
      completeSelection(newFolderId.toString());
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear la carpeta');
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
      <ThemedText style={styles.label}>Cliente *</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={clientItems}
        selectedValue={clientId !== null ? clientId.toString() : ''}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CLIENT_VALUE) {
            if (clientId !== null) {
              setClientId(null);
            }
            beginSelection(SELECTION_KEYS.folders.client);
            router.push('/clients/create');
            return;
          }
          setClientId(stringValue ? Number(stringValue) : null);
        }}
        placeholder="Selecciona un cliente"
        disabled={isClientFixed}
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CLIENT_VALUE) return;
          beginSelection(SELECTION_KEYS.folders.client);
          router.push(`/clients/${value}`);
        }}
      />

      <ThemedText style={styles.label}>Carpeta padre</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={parentItems}
        selectedValue={parentId !== null ? parentId.toString() : ''}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          setParentId(stringValue ? Number(stringValue) : null);
        }}
        placeholder="Sin carpeta padre"
        disabled={isParentFixed || clientId === null}
      />

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
  container: { padding: 16, paddingBottom: FORM_BOTTOM_SPACING },
  label: { marginVertical: 8, fontSize: 16 },
  select: {
    marginBottom: 8,
  },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
