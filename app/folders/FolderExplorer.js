// app/folders/FolderExplorer.js
import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Text 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../../src/config/index';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FolderItem from './FolderItem';
import FolderModal from './FolderModal';

export default function FolderExplorer() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Si se pasa el parámetro 'folder', significa que estamos dentro de una carpeta.
  const parsedFolder = useMemo(() => {
    if (params.folder) {
      try {
        const folder = JSON.parse(params.folder);
        console.log("[FolderExplorer] Parsed folder:", folder);
        return folder;
      } catch (err) {
        console.error("[FolderExplorer] Error al parsear 'folder':", err);
        return null;
      }
    }
    return null;
  }, [params.folder]);

  // Si se pasa el parámetro 'client', significa que estamos en la vista de un cliente (nivel superior)
  const parsedClient = useMemo(() => {
    if (params.client) {
      try {
        const client = JSON.parse(params.client);
        console.log("[FolderExplorer] Parsed client:", client);
        return client;
      } catch (err) {
        console.error("[FolderExplorer] Error al parsear 'client':", err);
        return null;
      }
    }
    return null;
  }, [params.client]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const loadItems = async () => {
    console.log("[FolderExplorer] Iniciando loadItems...");
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert("Error", "No se encontró el token de autenticación.");
        setLoading(false);
        return;
      }
      let url = "";
      if (parsedFolder) {
        // Si estamos dentro de una carpeta, listamos aquellas cuyo parent_id sea el id de la carpeta actual.
        url = `${BASE_URL}/folders?parent_id=${parsedFolder.id}`;
        console.log("[FolderExplorer] Cargando subcarpetas para folder ID:", parsedFolder.id);
      } else if (parsedClient) {
        // Si estamos en la vista de cliente, listamos las carpetas de ese cliente (nivel superior).
        url = `${BASE_URL}/folders?client_id=${parsedClient.id}`;
        console.log("[FolderExplorer] Cargando carpetas para cliente ID:", parsedClient.id);
      } else {
        // Vista raíz: se listan los clientes.
        url = `${BASE_URL}/clients`;
        console.log("[FolderExplorer] Cargando clientes (vista raíz).");
      }
      console.log("[FolderExplorer] URL:", url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      console.log("[FolderExplorer] Estado de la respuesta:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("[FolderExplorer] Datos recibidos:", data);
        // Si estamos en una vista interna (carpeta o cliente), se espera recibir un array de carpetas.
        if (parsedFolder || parsedClient) {
          setItems(data.folders || []);
        } else {
          // En la raíz se esperan clientes.
          setItems(data.clients || []);
        }
      } else {
        const errorData = await response.json();
        console.error("[FolderExplorer] Error en la petición:", errorData);
        Alert.alert("Error", errorData.error || "Error al obtener datos");
      }
    } catch (error) {
      console.error("[FolderExplorer] Error en loadItems:", error);
      Alert.alert("Error", error.message);
    } finally {
      console.log("[FolderExplorer] Finalizando loadItems.");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [parsedFolder, parsedClient]);

  // Al tocar un item, si es carpeta se navega hacia adentro
  const handleItemPress = (item) => {
    // Aseguramos que el objeto 'item' tenga el client_id
    let folderToPass = item;
    if (!item.client_id) {
      if (parsedFolder) {
        // Si ya estamos en una subcarpeta, usamos el client_id del folder padre o del cliente
        folderToPass = { ...item, client_id: parsedFolder.client_id || (parsedClient ? parsedClient.id : null) };
      } else if (parsedClient) {
        folderToPass = { ...item, client_id: parsedClient.id };
      }
    }
    if (parsedFolder || parsedClient) {
      router.push({
        pathname: "/folders/FolderExplorer",
        params: { folder: JSON.stringify(folderToPass) }
      });
      console.log("[FolderExplorer] Navegación iniciada con folder:", folderToPass);
    } else {
      // En la vista raíz (clientes)
      router.push({
        pathname: "/folders/FolderExplorer",
        params: { client: JSON.stringify(item) }
      });
      console.log("[FolderExplorer] Navegación iniciada con cliente:", item);
    }
  };

  const handleItemLongPress = (item) => {
    if (!parsedFolder && !parsedClient) {
      Alert.alert(item.business_name, "Acciones para clientes no implementadas en este ejemplo.");
    } else {
      Alert.alert(item.name, "Selecciona una opción", [
        { 
          text: "Editar", 
          onPress: () => { 
            setEditingItem(item); 
            setModalVisible(true);
            console.log("[FolderExplorer] Editar carpeta:", item);
          } 
        },
        { 
          text: "Eliminar", 
          onPress: () => { 
            console.log("[FolderExplorer] Eliminar carpeta con ID:", item.id);
            deleteFolder(item.id);
          }, 
          style: 'destructive' 
        },
        { text: "Cancelar", style: 'cancel' }
      ]);
    }
  };

  // Función para agregar carpeta incluyendo el client_id (siempre se retiene)
  const addFolder = async (folderData) => {
    if (!parsedClient && !parsedFolder) {
      Alert.alert("Error", "Solo se pueden agregar carpetas dentro de un cliente o carpeta.");
      return;
    }
    let parentIdentifier = {};
    if (parsedFolder) {
      parentIdentifier.parent_id = parsedFolder.id;
      // Si el folder actual no tiene client_id, se lo asignamos desde parsedFolder (si existe) o parsedClient
      parentIdentifier.client_id = parsedFolder.client_id ? parsedFolder.client_id : (parsedClient ? parsedClient.id : null);
    } else if (parsedClient) {
      parentIdentifier.client_id = parsedClient.id;
    }
    console.log("[FolderExplorer] Agregando carpeta con datos:", folderData, parentIdentifier);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/folders`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ...folderData, ...parentIdentifier })
      });
      console.log("[FolderExplorer] Estado de agregar carpeta:", response.status);
      if (response.ok) {
        const data = await response.json();
        Alert.alert("Éxito", data.message);
        loadItems();
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.error || "Error al crear carpeta");
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  // Función para actualizar carpeta; se añade client_id si no viene en updatedData
  const updateFolder = async (folderId, updatedData) => {
    console.log("[FolderExplorer] Actualizando carpeta con ID:", folderId, "Datos:", updatedData);
    
    // Si estamos editando desde una carpeta (parsedFolder) o vista de cliente, asignamos parent_id y client_id
    if (parsedFolder) {
      updatedData.parent_id = parsedFolder.id;
      updatedData.client_id = parsedFolder.client_id ? parsedFolder.client_id : (parsedClient ? parsedClient.id : null);
    } else if (parsedClient) {
      // En la vista de cliente de nivel superior, parent_id es null
      updatedData.parent_id = null;
      updatedData.client_id = parsedClient.id;
    }
    
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updatedData)
      });
      console.log("[FolderExplorer] Estado de actualizar carpeta:", response.status);
      if (response.ok) {
        const data = await response.json();
        Alert.alert("Éxito", data.message);
        loadItems();
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.error || "Error al actualizar carpeta");
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };
  
  const deleteFolder = async (folderId) => {
    console.log("[FolderExplorer] Eliminando carpeta con ID:", folderId);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      console.log("[FolderExplorer] Estado de eliminar carpeta:", response.status);
      if (response.ok) {
        const data = await response.json();
        Alert.alert("Éxito", data.message);
        loadItems();
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.error || "Error al eliminar carpeta");
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const renderItem = ({ item }) => (
    <FolderItem
      // Si no estamos en vista de carpeta, se asume que el objeto corresponde a un cliente,
      // y se mapea a { name, image } usando business_name y brand_file_id.
      folder={parsedFolder || parsedClient ? item : { name: item.business_name, image: item.brand_file_id }}
      onPress={() => handleItemPress(item)}
      onLongPress={() => handleItemLongPress(item)}
    />
  );

  return (
    <View style={styles.container}>
      {(parsedFolder || parsedClient) && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { router.back(); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007BFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {parsedFolder ? parsedFolder.name : parsedClient.business_name}
          </Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {(parsedFolder || parsedClient) 
                ? "No hay carpetas. Presiona + para agregar una nueva carpeta." 
                : "No se encontraron clientes."}
            </Text>
          </View>
        }
      />
      {(parsedFolder || parsedClient) && (
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => { 
            setEditingItem(null); 
            setModalVisible(true); 
          }}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}
      <FolderModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); }}
        onSubmit={(folderData) => {
          if (editingItem) {
            updateFolder(editingItem.id, folderData);
          } else {
            addFolder(folderData);
          }
          setModalVisible(false);
        }}
        folder={editingItem}
      />
      {loading && <Text style={styles.loadingText}>Cargando...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f0" },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 10, 
    paddingVertical: 15, 
    backgroundColor: "#fff", 
    elevation: 2 
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  listContainer: { padding: 10 },
  addButton: { 
    position: "absolute", 
    bottom: 20, 
    right: 20, 
    backgroundColor: "#007BFF", 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    alignItems: "center", 
    justifyContent: "center", 
    elevation: 4 
  },
  loadingText: { textAlign: "center", marginTop: 20, fontSize: 16 },
  emptyContainer: { alignItems: "center", marginTop: 20 },
  emptyText: { fontSize: 16, color: "#555" }
});
