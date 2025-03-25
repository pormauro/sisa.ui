// app/folders/AddFolder.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Button,
} from 'react-native';
// Usamos useLocalSearchParams para obtener los parámetros locales
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../src/config/index';
import CircleImagePicker from '../../src/components/CircleImagePicker';

export default function AddFolder() {
  const router = useRouter();
  // Se esperan recibir: clientId, clientName, parentId (opcional)
  const { clientId, clientName, parentId } = useLocalSearchParams();

  // Estado para almacenar todas las carpetas del cliente (para calcular la ruta)
  const [folders, setFolders] = useState([]);
  // Estado para la ruta calculada
  const [computedPath, setComputedPath] = useState('');
  // Estado para el nombre de la nueva carpeta
  const [name, setName] = useState('');
  // Estado para el fileId de la imagen de la carpeta
  const [folderImageFileId, setFolderImageFileId] = useState(null);

  // Cargar todas las carpetas del cliente desde la API
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        const response = await fetch(`${BASE_URL}/folders?client_id=${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        } else {
          Alert.alert('Error', 'No se pudieron cargar las carpetas');
        }
      } catch (error) {
        Alert.alert('Error', error.message);
      }
    };

    if (clientId) {
      loadFolders();
    }
  }, [clientId]);

  // Función para calcular la ruta (path) de la carpeta padre
  const computeFolderPath = (parentId, folders) => {
    let pathParts = [];
    let currentId = Number(parentId);
    // Construir un mapa (id -> folder) para acceso rápido
    const folderMap = {};
    folders.forEach((f) => {
      folderMap[f.id] = f;
    });
    // Recorrer la cadena de padres
    while (currentId) {
      const currentFolder = folderMap[currentId];
      if (currentFolder) {
        // Si el nombre está undefined, usar "..."
        pathParts.push(currentFolder.name ? currentFolder.name : '...');
        currentId = currentFolder.parent_id ? Number(currentFolder.parent_id) : null;
      } else {
        break;
      }
    }
    // Invertir el orden para que la raíz quede primero
    pathParts.reverse();
    // La ruta final es: clientName (o "..." si es undefined)/folder1/folder2/.../ (termina con "/")
    const base = clientName ? clientName : '...';
    return `${base}/${pathParts.join('/')}${pathParts.length ? '/' : ''}`;
  };

  // Actualizar la ruta calculada cuando cambie el parentId, las carpetas o el clientName
  useEffect(() => {
    if (parentId && folders.length > 0) {
      const path = computeFolderPath(parentId, folders);
      setComputedPath(path || '.../');
    } else {
      // Si no hay carpeta padre seleccionada, la ruta es solo el nombre del cliente seguido de "/"
      setComputedPath(`${clientName ? clientName : '...'}/`);
    }
  }, [parentId, folders, clientName]);

  // Callback para actualizar el fileId cuando se selecciona una imagen
  const handleImageChange = (newFileId) => {
    setFolderImageFileId(newFileId);
  };

  // Función para volver al explorador de carpetas con el cliente seleccionado
  const goToFolderExplorer = () => {
    // Se redirige a FolderManager pasando clientId y clientName
   /* router.push({
      pathname: '/folders/FolderExplorer',
      params: { clientId, clientName },
    });*/
    router.back();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre de la carpeta es requerido.');
      return;
    }
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: Number(clientId),
          name,
          // La carpeta padre se envía solo si se seleccionó
          parent_id: parentId ? Number(parentId) : null,
          folder_image_file_id: folderImageFileId, // Puede ser null
        }),
      });
      if (response.ok) {
        Alert.alert('Éxito', 'Carpeta creada.');
        goToFolderExplorer();
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error al crear la carpeta');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agregar Carpeta</Text>
      {/* Header: Muestra el directorio completo */}
      <View style={styles.header}>
        <Text style={styles.headerText}>dir: {computedPath}</Text>
      </View>

      <CircleImagePicker
        fileId={folderImageFileId}
        editable={true}
        size={200}
        onImageChange={handleImageChange}
      />
      <TextInput
        style={styles.input}
        placeholder="Nombre de la carpeta"
        value={name}
        onChangeText={setName}
      />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Guardar Carpeta</Text>
      </TouchableOpacity>
      <Button title="Cancelar" onPress={goToFolderExplorer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#fff' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  input: { 
    borderWidth: 1, 
    padding: 10, 
    marginVertical: 10, 
    borderRadius: 5 
  },
  saveButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
  },
  saveButtonText: { 
    color: '#fff', 
    fontSize: 18 
  },
});
