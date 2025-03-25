// app/products_services/ProductsServicesList.js
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
import Fuse from 'fuse.js';
import { BASE_URL } from '../../src/config/index';
import ProductServiceItem from './ProductServiceItem';

export default function ProductsServicesList() {
  const router = useRouter();
  const [productsServices, setProductsServices] = useState([]);
  const [filteredProductsServices, setFilteredProductsServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);

  // Activar animaciones en Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const loadProductsServices = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/products_services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const allProductsServices = data.products_services || data;
        setProductsServices(allProductsServices);
        setFilteredProductsServices(allProductsServices);
      } else {
        Alert.alert('Error', 'No se pudieron obtener los productos/servicios');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductsServices();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProductsServices(productsServices);
      return;
    }
    const options = {
      keys: ['description', 'category'],
      threshold: 0.4,
      includeScore: true,
    };
    const fuse = new Fuse(productsServices, options);
    const results = fuse.search(searchQuery);
    setFilteredProductsServices(results.map(result => result.item));
  }, [searchQuery, productsServices]);

  const handleDelete = async (productServiceId) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/products_services/${productServiceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        Alert.alert('Producto/Servicio eliminado');
        loadProductsServices();
        if (expandedItemId === productServiceId) {
          setExpandedItemId(null);
        }
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error eliminando el producto/servicio');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleEdit = (productServiceId) => {
    router.push(`./EditProductService?id=${productServiceId}`);
  };

  const handleToggle = (productServiceId) => {
    if (Platform.OS !== 'web' && LayoutAnimation && LayoutAnimation.configureNext) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedItemId(prev => (prev === productServiceId ? null : productServiceId));
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por descripción o categoría..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {loading ? (
        <ActivityIndicator size="large" color="#007BFF" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredProductsServices}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ProductServiceItem
              item={item}
              expanded={expandedItemId === item.id}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          )}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text>No hay productos/servicios disponibles.</Text>}
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
