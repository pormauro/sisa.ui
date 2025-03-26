// app/folders/FolderExplorer.js
import React, { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Text,
} from 'react-native';
import FolderItem from './FolderItem';
import FolderModal from './FolderModal';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function FolderExplorer() {
  const navigation = useNavigation();
  const route = useRoute();

  // Si no se recibe carpeta en route.params, estamos en la raíz.
  const currentFolder = route?.params?.folder || null;
  const isRoot = currentFolder === null;

  // Datos de ejemplo para la raíz (con parentId null) y para hijos (con parentId asignado)
  const rootFolders = [
    {
      id: '1',
      name: 'Documents',
      parentId: null,
      children: [
        { id: '11', name: 'Work Documents', parentId: '1', children: [] },
        { id: '12', name: 'Personal Documents', parentId: '1', children: [] },
      ],
    },
    {
      id: '2',
      name: 'Photos',
      parentId: null,
      children: [
        { id: '21', name: 'Vacations', parentId: '2', children: [] },
        { id: '22', name: 'Family', parentId: '2', children: [] },
      ],
    },
    { id: '3', name: 'Music', parentId: null, children: [] },
  ];

  // Si estamos en la raíz, usamos los folders raíz; si no, usamos los children de la carpeta actual.
  const initialFolders = isRoot ? rootFolders : currentFolder.children || [];

  const [folders, setFolders] = useState(initialFolders);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);

  // Agregar nueva carpeta asignándole el parentId de la carpeta actual (o null en raíz)
  const handleAddFolder = (newFolder) => {
    const newFolderObj = {
      id: String(Date.now()),
      ...newFolder,
      children: [],
      parentId: isRoot ? null : currentFolder.id,
    };
    setFolders([...folders, newFolderObj]);
  };

  // Editar una carpeta existente
  const handleEditFolder = (updatedFolder) => {
    setFolders(folders.map((f) => (f.id === updatedFolder.id ? updatedFolder : f)));
  };

  // Eliminar una carpeta tras confirmar con el usuario
  const handleDeleteFolder = (folderId) => {
    Alert.alert(
      'Eliminar carpeta',
      '¿Estás seguro que deseas eliminar esta carpeta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => setFolders(folders.filter((f) => f.id !== folderId)),
        },
      ]
    );
  };

  // Al tocar una carpeta, navega adentro pasando la carpeta actual como parámetro
  const handleFolderPress = (folder) => {
    navigation.push('FolderExplorer', { folder });
  };

  // Al mantener presionado, muestra opciones para editar o eliminar la carpeta
  const handleFolderLongPress = (folder) => {
    Alert.alert(folder.name, 'Selecciona una opción', [
      {
        text: 'Editar',
        onPress: () => {
          setEditingFolder(folder);
          setModalVisible(true);
        },
      },
      {
        text: 'Eliminar',
        onPress: () => handleDeleteFolder(folder.id),
        style: 'destructive',
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // Abre el modal para agregar una nueva carpeta
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
      {/* Cabecera con botón "volver" si no estamos en la raíz */}
      {!isRoot && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007BFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{currentFolder.name}</Text>
        </View>
      )}
      <FlatList
        data={folders}
        keyExtractor={(item) => item.id}
        renderItem={renderFolder}
        numColumns={3}
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
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 15,
    backgroundColor: '#fff',
    elevation: 2,
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
