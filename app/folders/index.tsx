// Archivo: app/folders/index.tsx

import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, StyleSheet, Text, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { FoldersContext, Folder } from '@/contexts/FoldersContext';
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

export default function FoldersPage() {
  const { folders, loadFolders, deleteFolder } = useContext(FoldersContext);
  const { clients, loadClients } = useContext(ClientsContext);
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  const client_id = params.client_id as string | undefined;
  const parent_id = params.parent_id as string | undefined;

  const canAddFolder = permissions.includes('addFolder');
  const canDeleteFolder = permissions.includes('deleteFolder');
  const canEditFolder = permissions.includes('updateFolder');

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
    <View style={styles.container}>
      {(client_id || parent_id) && (
        <TouchableOpacity style={styles.backButton} onPress={() => {
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
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
      )}

      <TextInput
        placeholder="Buscar..."
        style={styles.search}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {client_id || parent_id ? (
        <FlatList
          data={filteredFolders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => router.push({ pathname: '/folders', params: { parent_id: String(item.id) } })}
              onLongPress={() => canEditFolder && router.push(`/folders/${item.id}`)}>
              <CircleImagePicker fileId={item.folder_image_file_id} size={50} />
              <Text style={styles.text}>{item.name}</Text>
              {canDeleteFolder && (
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  {loadingId === item.id ? <ActivityIndicator /> : <Text style={styles.delete}>🗑️</Text>}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => router.push({ pathname: '/folders', params: { client_id: String(item.id) } })}>
              <CircleImagePicker fileId={item.brand_file_id} size={50} />
              <Text style={styles.text}>{item.business_name}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {canAddFolder && (client_id || parent_id) && (
        <TouchableOpacity
          style={styles.add}
          onPress={() => {
            const params: Record<string, string> = {};
            if (client_id) params.client_id = client_id;
            if (parent_id) params.parent_id = parent_id;
            router.push({ pathname: '/folders/create', params });
          }}>
          <Text style={styles.addText}>＋ Agregar carpeta</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  search: { padding: 10, borderWidth: 1, borderRadius: 8, borderColor: '#ddd', marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#eee' },
  text: { flex: 1, marginLeft: 10 },
  delete: { fontSize: 18 },
  add: { position: 'absolute', right: 16, bottom: 32, backgroundColor: '#007BFF', padding: 16, borderRadius: 30 },
  addText: { color: '#fff', fontWeight: 'bold' },
  backButton: { marginBottom: 10, padding: 8, backgroundColor: '#eee', borderRadius: 8 },
  backButtonText: { fontSize: 16 },
}); 