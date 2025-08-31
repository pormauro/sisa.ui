// app/cash_boxes/CashBoxesList.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { BASE_URL } from '../../../src/config/index';
import CashBoxItem from './CashBoxItem';

export default function CashBoxesList() {
  const router = useRouter();
  const [cashBoxes, setCashBoxes] = useState([]);
  const [filteredCashBoxes, setFilteredCashBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);

  // Activar animaciones en Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental &&
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Cargar cajas desde la API
  const loadCashBoxes = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/cash_boxes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const allCashBoxes = data.cash_boxes || data;
        setCashBoxes(allCashBoxes);
        setFilteredCashBoxes(allCashBoxes);
      } else {
        Alert.alert('Error', 'No se pudieron obtener las cajas de dinero');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashBoxes();
  }, []);

  // Fuzzy search con Fuse (busca en el campo "name")
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCashBoxes(cashBoxes);
      return;
    }
    const options = {
      keys: ['name'],
      threshold: 0.4,
      includeScore: true,
    };
    const fuse = new Fuse(cashBoxes, options);
    const results = fuse.search(searchQuery);
    setFilteredCashBoxes(results.map(result => result.item));
  }, [searchQuery, cashBoxes]);

  const handleDelete = async (cashBoxId) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/cash_boxes/${cashBoxId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        Alert.alert('Caja eliminada');
        loadCashBoxes();
        if (expandedItemId === cashBoxId) {
          setExpandedItemId(null);
        }
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error eliminando la caja');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleEdit = (cashBoxId) => {
    router.push(`./EditCashBox?id=${cashBoxId}`);
  };

  const handleToggle = (cashBoxId) => {
    if (Platform.OS !== 'web' && LayoutAnimation && LayoutAnimation.configureNext) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedItemId(prev => (prev === cashBoxId ? null : cashBoxId));
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar cajas..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredCashBoxes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <CashBoxItem
              item={item}
              expanded={expandedItemId === item.id}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          )}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text>No hay cajas de dinero disponibles.</Text>}
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
    padding: 20,
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
});
