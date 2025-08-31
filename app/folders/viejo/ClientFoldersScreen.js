import React, { useEffect, useState } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Text 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FolderItem from './FolderItem';

export default function ClientFoldersScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'No se encontró token de autenticación.');
        setLoading(false);
        return;
      }
      const response = await fetch('https://sistema.depros.com.ar/clients', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Error al obtener clientes');
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

  // Al tocar un cliente, se navega a FolderExplorer pasando el cliente seleccionado
  const handleClientPress = (client) => {
    console.log("Cliente presionado:", client);
    navigation.navigate('FolderExplorer', { client: JSON.stringify(client) });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleClientPress(item)}>
      <FolderItem folder={{ name: item.business_name, image: item.brand_file_id }} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
      />
      {loading && <Text style={styles.loadingText}>Cargando clientes...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  listContainer: { padding: 10 },
  loadingText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
