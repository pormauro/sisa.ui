// app/folders/FoldersScreen.js
import React, { useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, Text } from 'react-native';
import FolderItem from './FolderItem';
import FolderModal from './FolderModal';
import { Ionicons } from '@expo/vector-icons'; // Usamos Ionicons para el ícono del botón +

export default function FoldersScreen({ navigation }) {
  // Datos de ejemplo; en un caso real estos datos vendrían de una API o servicio.
  const [folders, setFolders] = useState([
    { id: '1', name: 'Documents', image: null },
    { id: '2', name: 'Photos', image: 'https://example.com/photo-folder.png' },
    { id: '3', name: 'Music', image: null },
  ]);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);

  // Función para agregar una nueva carpeta
  const handleAddFolder = (newFolder) => {
    setFolders([...folders, { id: String(Date.now()), ...newFolder }]);
  };

  // Función para editar una carpeta existente
  const handleEditFolder = (updatedFolder) => {
    setFolders(folders.map(f => f.id === updatedFolder.id ? updatedFolder : f));
  };

  // Función para eliminar una carpeta
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
            setFolders(folders.filter(f => f.id !== folderId));
          }
        }
      ]
    );
  };

  // Acción al hacer tap sobre una carpeta
  const handleFolderPress = (folder) => {
    // Aquí puedes navegar a la pantalla de contenido de la carpeta.
    // Ejemplo: navigation.navigate('FolderContent', { folderId: folder.id });
    Alert.alert('Entrar en carpeta', `Entrando en la carpeta: ${folder.name}`);
  };

  // Acción al hacer long press sobre una carpeta: opciones de editar o eliminar.
  const handleFolderLongPress = (folder) => {
    Alert.alert(
      folder.name,
      'Selecciona una opción',
      [
        {
          text: 'Editar',
          onPress: () => {
            setEditingFolder(folder);
            setModalVisible(true);
          }
        },
        {
          text: 'Eliminar',
          onPress: () => handleDeleteFolder(folder.id),
          style: 'destructive'
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  // Abre el modal para agregar una carpeta nueva
  const openAddModal = () => {
    setEditingFolder(null);
    setModalVisible(true);
  };

  const renderFolder = ({ item }) => (
    <FolderItem 
      folder={item} 
      onPress={() => handleFolderPress(item)} 
      onLongPress={() => handleFolderLongPress(item)} 
    />
  );

  return (
    <View style={styles.container}>
      <FlatList 
        data={folders}
        keyExtractor={(item) => item.id}
        renderItem={renderFolder}
        numColumns={3} // Grid de 3 columnas; ajusta según prefieras
        contentContainerStyle={styles.listContainer}
      />
      <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
      <FolderModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)}
        onSubmit={(folderData) => {
          if (editingFolder) {
            handleEditFolder({ ...editingFolder, ...folderData });
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
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0'
  },
  listContainer: {
    padding: 10,
  },
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
