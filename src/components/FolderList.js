// src/components/FolderList.js
import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, ActivityIndicator, Button } from 'react-native';
import { deleteFolder, editFolder } from '../services/folderService';
import { useFolders } from '../hooks/useFolders';

export default function FolderList({ onEditFolder }) {
  const { folders, loading, error, reload } = useFolders();
  const [editingFolderId, setEditingFolderId] = useState(null);

  const handleDelete = async (folderId) => {
    try {
      await deleteFolder(folderId);
      Alert.alert('Folder deleted successfully');
      reload();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleEdit = async (folderId, newFolderData) => {
    try {
      const updatedFolder = await editFolder(folderId, newFolderData);
      Alert.alert('Folder updated successfully');
      // Propagar la acción o actualizar localmente según sea necesario
      if (onEditFolder) onEditFolder(updatedFolder);
      reload();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderFolder = ({ item }) => (
    <View style={styles.folderContainer}>
      <Text style={styles.folderName}>{item.name}</Text>
      <View style={styles.buttonsContainer}>
        <Button title="Edit" onPress={() => setEditingFolderId(item.id)} />
        <Button title="Delete" onPress={() => handleDelete(item.id)} />
      </View>
      {editingFolderId === item.id && (
        // Aquí podrías mostrar un formulario o modal para editar la carpeta
        // Por simplicidad, se muestra un ejemplo de edición directa
        <View style={styles.editContainer}>
          <Text>Edit folder: {item.name}</Text>
          {/* Implementar el formulario y llamar a handleEdit cuando se confirme */}
        </View>
      )}
    </View>
  );

  if (loading) return <ActivityIndicator size="large" color="#007BFF" style={styles.loader} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (folders.length === 0) return <Text>No folders available.</Text>;

  return (
    <FlatList
      data={folders}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderFolder}
      contentContainerStyle={styles.listContainer}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 10,
  },
  folderContainer: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  folderName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  editContainer: {
    marginTop: 10,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
});
