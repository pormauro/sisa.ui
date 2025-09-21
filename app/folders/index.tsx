// Archivo: app/folders/index.tsx

import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { FoldersContext, Folder } from '@/contexts/FoldersContext';
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function FoldersPage() {
  const { folders, loadFolders, deleteFolder } = useContext(FoldersContext);
  const { clients, loadClients } = useContext(ClientsContext);
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const backButtonColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const spinnerColor = useThemeColor({}, 'tint');

  const client_id = params.client_id as string | undefined;
  const parent_id = params.parent_id as string | undefined;

  const canAddFolder = permissions.includes('addFolder');
  const canDeleteFolder = permissions.includes('deleteFolder');
  const canEditFolder = permissions.includes('updateFolder');
  const isRootLevel = !client_id && !parent_id;

  const handleAddFolder = () => {
    if (client_id || parent_id) {
      const params: Record<string, string> = {};
      if (client_id) params.client_id = client_id;
      if (parent_id) params.parent_id = parent_id;
      router.push({ pathname: '/folders/create', params });
      return;
    }
    router.push('/folders/create');
  };

  useEffect(() => {
    loadFolders();
    loadClients();
  }, []);

  const currentFolders: Folder[] = useMemo(() => {
    if (parent_id) {
      return folders.filter(f => f.parent_id === Number(parent_id));
    } else if (client_id) {
      return folders.filter(f => f.client_id === Number(client_id) && f.parent_id === null);
    } else {
      return []; // no folders, show clients instead
    }
  }, [folders, client_id, parent_id]);

  const fuseFolders = new Fuse(currentFolders, { keys: ['name'] });
  const filteredFolders = searchQuery ? fuseFolders.search(searchQuery).map(r => r.item) : currentFolders;

  const fuseClients = new Fuse(clients, { keys: ['business_name', 'email', 'tax_id'] });
  const filteredClients = searchQuery ? fuseClients.search(searchQuery).map(r => r.item) : clients;

  const handleDelete = (id: number) => {
    Alert.alert('Confirmar eliminación', '¿Seguro deseas eliminar la carpeta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoadingId(id);
          await deleteFolder(id);
          setLoadingId(null);
        },
      },
    ]);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}> 
      {(client_id || parent_id) && (
        <TouchableOpacity style={[styles.backButton, { backgroundColor: backButtonColor }]} onPress={() => {
          if (parent_id) {
            const parentFolder = folders.find(f => f.id === Number(parent_id));
            if (parentFolder?.parent_id) {
              router.push({ pathname: '/folders', params: { parent_id: String(parentFolder.parent_id) } });
            } else {
              router.push({ pathname: '/folders', params: { client_id: String(parentFolder?.client_id ?? '') } });
            }
          } else if (client_id) {
            router.push('/folders');
          }
        }}>
          <ThemedText style={styles.backButtonText}>← Volver</ThemedText>
        </TouchableOpacity>
      )}

      <TextInput
        placeholder="Buscar..."
        style={[styles.search, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor={placeholderColor}
      />

      {client_id || parent_id ? (
        <FlatList
          data={filteredFolders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { borderColor: itemBorderColor }]}
              onPress={() => router.push({ pathname: '/folders', params: { parent_id: String(item.id) } })}
              onLongPress={() => canEditFolder && router.push(`/folders/${item.id}`)}>
              <CircleImagePicker fileId={item.folder_image_file_id} size={50} />
              <ThemedText style={[styles.text, { color: textColor }]}>{item.name}</ThemedText>
              {canDeleteFolder && (
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  {loadingId === item.id ? (
                    <ActivityIndicator color={spinnerColor} />
                  ) : (
                    <ThemedText style={styles.delete}>🗑️</ThemedText>
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: canAddFolder ? 120 : 0 }} />}
        />
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { borderColor: itemBorderColor }]}
              onPress={() => router.push({ pathname: '/folders', params: { client_id: String(item.id) } })}>
              <CircleImagePicker fileId={item.brand_file_id} size={50} />
              <ThemedText style={[styles.text, { color: textColor }]}>{item.business_name}</ThemedText>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: canAddFolder ? 120 : 0 }} />}
        />
      )}

      {canAddFolder && (
        <TouchableOpacity
          style={[styles.add, { backgroundColor: addButtonColor }]}
          onPress={handleAddFolder}
          accessibilityLabel={isRootLevel ? 'Agregar carpeta en la raíz' : 'Agregar carpeta'}
        >
          <ThemedText style={[styles.addText, { color: addButtonTextColor }]}>＋ Agregar carpeta</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  search: { padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  text: { flex: 1, marginLeft: 10 },
  delete: { fontSize: 18 },
  add: { position: 'absolute', right: 16, bottom: 32, padding: 16, borderRadius: 30 },
  addText: { fontWeight: 'bold' },
  backButton: { marginBottom: 10, padding: 8, borderRadius: 8 },
  backButtonText: { fontSize: 16 },
  listContent: { paddingBottom: 16 },
});
