import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  UIManager,
  LayoutAnimation,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import ClientItem from './ClientItem';
import { BASE_URL } from '../../src/config/index';
import Fuse from 'fuse.js';

export default function ClientList({ onSelectedClient }) {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Estado para almacenar el id del item actualmente expandido (null si ninguno)
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

  // Cargar clientes desde la API
  const loadClients = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const allClients = data.clients || data;
        setClients(allClients);
        setFilteredClients(allClients);
      } else {
        Alert.alert('Error', 'No se pudieron obtener los clientes');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
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
      threshold: 0.4, // Ajusta la sensibilidad de la búsqueda
      includeScore: true,
    };
    const fuse = new Fuse(clients, options);
    const results = fuse.search(searchQuery);
    const matchedClients = results.map(result => result.item);
    setFilteredClients(matchedClients);
  }, [searchQuery, clients]);

  const handleDelete = async (clientId) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/clients/${clientId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        Alert.alert('Cliente eliminado');
        loadClients();
        if (expandedItemId === clientId) {
          setExpandedItemId(null);
        }
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error eliminando el cliente');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
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
    width: '100%',  // Se ocupa todo el ancho de la pantalla
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
