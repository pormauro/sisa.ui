import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FolderItem from './FolderItem';
import FolderModal from './FolderModal';
import { getFolderTree, addFolder, updateFolder, deleteFolder } from '../../src/services/FolderResource';

export default function FolderExplorer() {
  const [folders, setFolders] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);

  // Cargar el árbol de carpetas al iniciar
  useEffect(() => {
    setFolders(getFolderTree());
  }, []);

  const handleAddFolder = (folderData) => {
    try {
      // Si se pasa un parentId (por ejemplo, desde FolderExplorer actual) se lo agrega; aquí se asume null para raíz
      addFolder(folderData, null);
      setFolders([...getFolderTree()]);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleEditFolder = (updatedData) => {
    try {
      updateFolder(editingFolder.id, updatedData);
      setFolders([...getFolderTree()]);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteFolder = (folderId) => {
    Alert.alert(
      'Eliminar carpeta',
      '¿Estás seguro que deseas eliminar esta carpeta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            try {
              deleteFolder(folderId);
              setFolders([...getFolderTree()]);
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderFolder = ({ item }) => (
    <FolderItem
      folder={item}
      onPress={() => {
        // Aquí podrías navegar a una vista de subcarpetas o mostrar detalles
        console.log('Folder pressed:', item.name);
      }}
      onLongPress={() => {
        Alert.alert(item.name, 'Selecciona una opción', [
          {
            text: 'Editar',
            onPress: () => {
              setEditingFolder(item);
              setModalVisible(true);
            },
          },
          {
            text: 'Eliminar',
            onPress: () => handleDeleteFolder(item.id),
            style: 'destructive',
          },
          { text: 'Cancelar', style: 'cancel' },
        ]);
      }}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={folders}
        keyExtractor={(item) => item.id}
        renderItem={renderFolder}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text>No hay carpetas disponibles.</Text>}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => {
        setEditingFolder(null);
        setModalVisible(true);
      }}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
      <FolderModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={(folderData) => {
          if (editingFolder) {
            handleEditFolder(folderData);
          } else {
            handleAddFolder(folderData);
          }
          setModalVisible(false);
        }}
        folder={editingFolder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  listContainer: { padding: 10 },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007BFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
