// app/folders/FolderManager.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ClientList from '../clients/ClientList';
import { useRouter } from 'expo-router';
import { BASE_URL } from '../../src/config/index';
import CircleImagePicker from '../../src/components/CircleImagePicker';

// Función para construir la estructura de carpetas ordenada alfabéticamente por cada padre
function computeSortedFolders(folders) {
  // Agrupamos las carpetas por parent_id; tratamos null como 0 (raíz)
  const groups = {};
  folders.forEach(folder => {
    const pid = folder.parent_id ? folder.parent_id : 0;
    if (!groups[pid]) groups[pid] = [];
    groups[pid].push(folder);
  });
  // Ordenamos cada grupo por el nombre de la carpeta
  Object.keys(groups).forEach(pid => {
    groups[pid].sort((a, b) => a.name.localeCompare(b.name));
  });
  // Recorremos de forma recursiva a partir de la raíz (parent id 0)
  const result = [];
  function traverse(parentId, level) {
    const children = groups[parentId] || [];
    children.forEach(child => {
      child.level = level;
      result.push(child);
      traverse(child.id, level + 1);
    });
  }
  traverse(0, 1);
  return result;
}

// Componente para representar cada carpeta en el explorador
const FolderItem = ({ folder, onPress, onEdit, selected }) => {
  return (
    <TouchableOpacity
      style={[
        styles.folderItem,
        { paddingLeft: folder.level * 20 },
        selected && styles.selectedFolder,
      ]}
      onPress={() => onPress(folder)}
      onLongPress={() => onEdit(folder)}
      delayLongPress={600}
    >
      <View style={styles.folderLineContainer}>
        {folder.level > 0 && <View style={[styles.folderLine, { left: 10 }]} />}
        <Text style={styles.folderText}>📁 {folder.name}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Componente que muestra el explorador de folders para el cliente seleccionado,
// cargando la información desde la API e incluyendo el item raíz ("...")
const FolderExplorer = ({ clientId, onEditFolder, selectedFolder, onSelectFolder }) => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carga las carpetas desde la API según el clientId y las ordena por cada grupo
  useEffect(() => {
    const loadFolders = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert('Error', 'No se encontró el token');
          return;
        }
        const response = await fetch(
          `${BASE_URL}/folders?client_id=${clientId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          // Se asume que data.folders es el array de carpetas de la API
          const sortedFolders = computeSortedFolders(data.folders || []);
          setFolders(sortedFolders);
        } else {
          Alert.alert('Error', 'No se pudieron cargar las carpetas');
        }
      } catch (error) {
        Alert.alert('Error', error.message);
      } finally {
        setLoading(false);
      }
    };

    if (clientId) {
      loadFolders();
    }
  }, [clientId]);

  if (loading) return <ActivityIndicator size="large" color="#007BFF" />;

  // Agregamos manualmente el item raíz "..."
  const rootFolder = { id: 0, name: '...', level: 0 };
  const allFolders = [rootFolder, ...folders];

  return (
    <FlatList
      data={allFolders}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <FolderItem
          folder={item}
          onPress={onSelectFolder}
          onEdit={onEditFolder}
          selected={selectedFolder?.id === item.id}
        />
      )}
    />
  );
};

// Componente principal que integra la selección de cliente y el explorador de folders
const FolderManager = () => {
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  // Por defecto, la carpeta seleccionada es la raíz
  const [selectedFolder, setSelectedFolder] = useState({ id: 0, name: '...' });
  const router = useRouter();

  // Abre el modal para seleccionar cliente
  const openClientModal = () => {
    setClientModalVisible(true);
  };

  // Callback para recibir el cliente seleccionado desde ClientList
  const handleSelectedClient = (client) => {
    if (client) {
      setSelectedClient(client);
      setClientModalVisible(false);
      // Reinicia la carpeta seleccionada a la raíz
      setSelectedFolder({ id: 0, name: '...' });
    }
  };

  // Función para ir a agregar una carpeta
  const handleAddFolder = () => {
    if (!selectedClient) {
      Alert.alert('Seleccione un cliente', 'Debe seleccionar un cliente primero.');
      return;
    }
    // Navega al componente para agregar carpeta
    // Se envían parámetros: clientId y parentId (de la carpeta seleccionada)
    router.push({
      pathname: '/folders/AddFolder',
      params: { clientId: selectedClient.id, parentId: selectedFolder.id },
    });
  };

  // Función para editar una carpeta (activada con long press en FolderItem)
  const handleEditFolder = (folder) => {
    router.push({
      pathname: '/folders/AddEditFolder',
      params: { clientId: selectedClient.id, folderId: folder.id },
    });
  };

  return (
    <View style={styles.container}>
      {/* Header: Si hay cliente seleccionado, muestra el nombre y la foto */}
      <TouchableOpacity onPress={() => setClientModalVisible(true)}>
        {selectedClient ? (
          <View style={styles.selectedClientContainer}>
            <Text style={styles.selectedClientText}>{selectedClient.business_name}</Text>
            <CircleImagePicker
              fileId={selectedClient.brand_file_id}
              editable={false}
              size={50}
            />
          </View>
        ) : (
          <TouchableOpacity style={styles.selectClientButton} onPress={openClientModal}>
            <Text style={styles.selectClientText}>Seleccionar Cliente</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Área de explorador de carpetas */}
      {selectedClient && (
        <View style={styles.folderExplorerContainer}>
          <Text style={styles.sectionTitle}>Explorador de Carpetas</Text>
          <FolderExplorer
            clientId={selectedClient.id}
            onEditFolder={handleEditFolder}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
          />
          <TouchableOpacity style={styles.addFolderButton} onPress={handleAddFolder}>
            <Text style={styles.addFolderButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal para selección de cliente */}
      <Modal visible={clientModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Seleccione un Cliente</Text>
          <ClientList onSelectedClient={handleSelectedClient} />
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => setClientModalVisible(false)}
          >
            <Text style={styles.closeModalText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

export default FolderManager;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  selectedClientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E2FA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  selectedClientText: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10, // Margen a la derecha para separar el nombre de la imagen
  },
  selectClientButton: {
    backgroundColor: '#28A745',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 20,
  },
  selectClientText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  folderExplorerContainer: {
    flex: 1,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  addFolderButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007BFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  addFolderButtonText: {
    fontSize: 30,
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  closeModalButton: {
    backgroundColor: '#FF3333',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  closeModalText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  folderItem: {
    marginVertical: 5,
  },
  folderLineContainer: {
    position: 'relative',
  },
  folderLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#ccc',
  },
  folderText: {
    fontSize: 16,
  },
  noFoldersText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  selectedFolder: {
    backgroundColor: '#D0E8FF',
    borderRadius: 5,
  },
});
