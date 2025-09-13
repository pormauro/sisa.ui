// src/components/FolderList.js
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Button,
  TextInput,
} from 'react-native';
import { deleteFolder, editFolder } from '../services/folderService';
import { useFolders } from '../hooks/useFolders';

export default function FolderList({ onEditFolder }) {
  const { folders, loading, error, reload } = useFolders();
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleDelete = async (folderId) => {
    try {
      await deleteFolder(folderId);
      Alert.alert('Folder deleted successfully');
      reload();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleEdit = async () => {
    try {
      const updatedFolder = await editFolder(editingFolderId, { name: editingName });
      Alert.alert('Folder updated successfully');
      if (onEditFolder) onEditFolder(updatedFolder);
      setEditingFolderId(null);
      setEditingName('');
      reload();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderFolder = ({ item }) => (
    <View style={styles.folderContainer}>
      <Text style={styles.folderName}>{item.name}</Text>
      <View style={styles.buttonsContainer}>
        <Button
          title="Edit"
          onPress={() => {
            setEditingFolderId(item.id);
            setEditingName(item.name);
          }}
        />
        <Button title="Delete" onPress={() => handleDelete(item.id)} />
      </View>
      {editingFolderId === item.id && (
        <View style={styles.editContainer}>
          <TextInput
            value={editingName}
            onChangeText={setEditingName}
            style={styles.input}
            placeholder="Folder name"
          />
          <View style={styles.buttonsContainer}>
            <Button title="Save" onPress={handleEdit} />
            <Button title="Cancel" onPress={() => setEditingFolderId(null)} />
          </View>
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 5,
    borderRadius: 4,
    marginBottom: 10,
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
