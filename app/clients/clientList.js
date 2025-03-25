import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  UIManager,
  LayoutAnimation,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import ClientItem from './ClientItem';
import Fuse from 'fuse.js';

<<<<<<< HEAD
// Importar funciones de la BD local y sincronización
import { 
  getAllClientsLocal, 
  deleteClientLocal, 
  createLocalClientsTable, 
  syncFromServer 
} from '../../src/database/clientsLocalDB';

// Importar la función para registrar errores en el log interno
import { logErrorToLocal } from '../../src/database/errorLogger';

export default function ClientList() {
=======
export default function ClientList({ onSelectedClient }) {
>>>>>>> nueva-rama
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Almacena el id del item actualmente expandido (null si ninguno)
  const [expandedItemId, setExpandedItemId] = useState(null);

// Propagar el cliente seleccionado al componente contenedor
useEffect(() => {
  if (onSelectedClient) {
    const selectedClient = clients.find(client => client.id === expandedItemId);
    onSelectedClient(selectedClient || null);
  }
}, [expandedItemId, clients]);

  // Activar animaciones en Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental &&
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Consulta primero la BD local y luego intenta actualizarla desde el servidor.
  const loadClients = async () => {
    setLoading(true);
    try {
      await createLocalClientsTable();
      const localClients = await getAllClientsLocal();
      setClients(localClients);
      setFilteredClients(localClients);
    } catch (error) {
      await logErrorToLocal(error);
    } finally {
      setLoading(false);
      updateClients();
    }
  };

  // Actualiza los datos consultando el servidor.
  const updateClients = async () => {
    try {
      await syncFromServer();
      const updatedClients = await getAllClientsLocal();
      setClients(updatedClients);
      setFilteredClients(updatedClients);
    } catch (error) {
      await logErrorToLocal(error);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Configurar Fuse para búsqueda avanzada (fuzzy search)
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClients(clients);
      return;
    }
    const options = {
      keys: ['business_name', 'tax_id', 'email', 'address', 'phone'],
      threshold: 0.4,
      includeScore: true,
    };
    const fuse = new Fuse(clients, options);
    const results = fuse.search(searchQuery);
    const matchedClients = results.map(result => result.item);
    setFilteredClients(matchedClients);
  }, [searchQuery, clients]);

  const handleDelete = async (clientId) => {
    try {
      const result = await deleteClientLocal(clientId);
      if (result > 0) {
        loadClients();
        if (expandedItemId === clientId) {
          setExpandedItemId(null);
        }
      } else {
        await logErrorToLocal(new Error('No se pudo eliminar el cliente'));
      }
    } catch (error) {
      await logErrorToLocal(error);
    }
  };

  const handleEdit = (clientId) => {
    router.push(`./editClient?id=${clientId}`);
  };

  // Alterna el estado expandido: solo un item se expande a la vez
  const handleToggle = (clientId) => {
    if (Platform.OS !== 'web' && LayoutAnimation && LayoutAnimation.configureNext) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedItemId(prev => (prev === clientId ? null : clientId));
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar clientes..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ClientItem
              item={item}
              expanded={expandedItemId === item.id}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          )}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text>No hay clientes disponibles.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    width: '100%',
    backgroundColor: '#fff',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  listContainer: { 
    marginTop: 20,
  },
  loader: { 
    marginTop: 20,
  },
  selectedClientText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 10,
  },
});
