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

  // Memorizar el parsedClient para que no se recree en cada render
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
    } else {
      console.log("[FolderExplorer] No se recibió parámetro 'client'. Vista raíz (clientes).");
      return null;
    }
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
        console.log("[FolderExplorer] Token no encontrado");
        Alert.alert("Error", "No se encontró el token de autenticación.");
        setLoading(false);
        return;
      }
      console.log("[FolderExplorer] Token obtenido:", token);
      let url = "";
      if (parsedClient) {
        // Usamos el endpoint correcto: /folders?client_id=ID
        url = `${BASE_URL}/folders?client_id=${parsedClient.id}`;
        console.log("[FolderExplorer] Cargando carpetas para cliente ID:", parsedClient.id);
      } else {
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
        setItems(parsedClient ? data.folders || [] : data.clients || []);
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
  }, [parsedClient]);

  const handleItemPress = (item) => {
    if (!parsedClient) {
      console.log("[FolderExplorer] Cliente presionado:", item);
      router.push({
        pathname: "/folders/FolderExplorer",
        params: { client: JSON.stringify(item) }
      });
      console.log("[FolderExplorer] Navegación iniciada con cliente.");
    } else {
      console.log("[FolderExplorer] Se presionó una carpeta; sin navegación adicional.");
      Alert.alert("Info", "No hay subcarpetas adicionales por ahora.");
    }
  };

  const handleItemLongPress = (item) => {
    if (!parsedClient) {
      console.log("[FolderExplorer] Long press en cliente. Sin acciones implementadas.");
      Alert.alert(item.business_name, "Acciones para clientes no implementadas en este ejemplo.");
    } else {
      console.log("[FolderExplorer] Long press en carpeta:", item);
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

  const addFolder = async (folderData) => {
    if (!parsedClient) {
      console.log("[FolderExplorer] Intento de agregar carpeta sin cliente.");
      Alert.alert("Error", "Solo se pueden agregar carpetas dentro de un cliente.");
      return;
    }
    console.log("[FolderExplorer] Agregando carpeta con datos:", folderData);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/folders`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ...folderData, client_id: parsedClient.id })
      });
      console.log("[FolderExplorer] Estado de agregar carpeta:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("[FolderExplorer] Carpeta agregada:", data);
        Alert.alert("Éxito", data.message);
        loadItems();
      } else {
        const errorData = await response.json();
        console.error("[FolderExplorer] Error al agregar carpeta:", errorData);
        Alert.alert("Error", errorData.error || "Error al crear carpeta");
      }
    } catch (error) {
      console.error("[FolderExplorer] Error en addFolder:", error);
      Alert.alert("Error", error.message);
    }
  };

  const updateFolder = async (folderId, updatedData) => {
    console.log("[FolderExplorer] Actualizando carpeta con ID:", folderId, "Datos:", updatedData);
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
        console.log("[FolderExplorer] Carpeta actualizada:", data);
        Alert.alert("Éxito", data.message);
        loadItems();
      } else {
        const errorData = await response.json();
        console.error("[FolderExplorer] Error al actualizar carpeta:", errorData);
        Alert.alert("Error", errorData.error || "Error al actualizar carpeta");
      }
    } catch (error) {
      console.error("[FolderExplorer] Error en updateFolder:", error);
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
        console.log("[FolderExplorer] Carpeta eliminada:", data);
        Alert.alert("Éxito", data.message);
        loadItems();
      } else {
        const errorData = await response.json();
        console.error("[FolderExplorer] Error al eliminar carpeta:", errorData);
        Alert.alert("Error", errorData.error || "Error al eliminar carpeta");
      }
    } catch (error) {
      console.error("[FolderExplorer] Error en deleteFolder:", error);
      Alert.alert("Error", error.message);
    }
  };

  const renderItem = ({ item }) => (
    <FolderItem
      folder={parsedClient ? item : { name: item.business_name, image: item.brand_file_id }}
      onPress={() => handleItemPress(item)}
      onLongPress={() => handleItemLongPress(item)}
    />
  );

  return (
    <View style={styles.container}>
      {parsedClient && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { console.log("[FolderExplorer] Volviendo..."); router.back(); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007BFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{parsedClient.business_name}</Text>
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
              {parsedClient 
                ? "No hay carpetas. Presiona + para agregar una nueva carpeta." 
                : "No se encontraron clientes."}
            </Text>
          </View>
        }
      />
      {parsedClient && (
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => { 
            console.log("[FolderExplorer] Abriendo modal para agregar carpeta");
            setEditingItem(null); 
            setModalVisible(true); 
          }}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}
      <FolderModal
        visible={modalVisible}
        onClose={() => { console.log("[FolderExplorer] Cerrando modal"); setModalVisible(false); }}
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
