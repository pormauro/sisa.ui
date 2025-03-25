// app/products_services/EditProductService.js
import React, { useEffect, useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Button,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRoute } from '@react-navigation/native';
import { BASE_URL } from '../../src/config/index';
import CircleImagePicker from '../../src/components/CircleImagePicker';

export default function EditProductService() {
  const router = useRouter();
  const route = useRoute();
  const { id } = route.params; // ID del producto/servicio

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: '',
    category: '',
    price: '',
    cost: '',
    difficulty: '',
    item_type: '',
    stock: '',
    product_image_file_id: null,
  });

  const loadProductService = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${BASE_URL}/products_services/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const productService = data.product_service;
        setForm({
          description: productService.description || '',
          category: productService.category || '',
          price: productService.price ? productService.price.toString() : '',
          cost: productService.cost ? productService.cost.toString() : '',
          difficulty: productService.difficulty || '',
          item_type: productService.item_type || '',
          stock: productService.stock ? productService.stock.toString() : '0',
          product_image_file_id: productService.product_image_file_id,
        });
      } else {
        Alert.alert('Error', 'No se pudo obtener la información del producto/servicio');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadProductService();
  }, [id]);

  const handleImageUpdate = (newFileId) => {
    setForm({ ...form, product_image_file_id: newFileId });
  };

  const handleSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    const url = `${BASE_URL}/products_services/${id}`;
    try {
      // Convertir price, cost y stock a números
      const payload = {
        ...form,
        price: parseFloat(form.price),
        cost: form.cost ? parseFloat(form.cost) : null,
        stock: parseInt(form.stock, 10),
      };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        Alert.alert('Éxito', 'Producto/Servicio actualizado');
        router.push('./ProductsServicesScreen');
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error al guardar');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de eliminar este producto/servicio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) return;
              const response = await fetch(`${BASE_URL}/products_services/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Producto/Servicio eliminado');
                router.push('./ProductsServicesScreen');
              } else {
                const errData = await response.json();
                Alert.alert('Error', errData.error || 'Error eliminando');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Editar Producto/Servicio</Text>

      <CircleImagePicker
        fileId={form.product_image_file_id}
        size={200}
        editable={true}
        onImageChange={handleImageUpdate}
      />

      <TextInput
        style={styles.input}
        placeholder="Descripción"
        value={form.description}
        onChangeText={(text) => setForm({ ...form, description: text })}
      />
      <TextInput
        style={styles.input}
        placeholder="Categoría"
        value={form.category}
        onChangeText={(text) => setForm({ ...form, category: text })}
      />
      <TextInput
        style={styles.input}
        placeholder="Precio"
        value={form.price}
        keyboardType="numeric"
        onChangeText={(text) => setForm({ ...form, price: text })}
      />
      <TextInput
        style={styles.input}
        placeholder="Costo"
        value={form.cost}
        keyboardType="numeric"
        onChangeText={(text) => setForm({ ...form, cost: text })}
      />
      <TextInput
        style={styles.input}
        placeholder="Dificultad"
        value={form.difficulty}
        onChangeText={(text) => setForm({ ...form, difficulty: text })}
      />
        <Text style={styles.label}>Tipo</Text>
        <Picker
        selectedValue={form.item_type}
        style={styles.picker}
        onValueChange={(itemValue) => setForm({ ...form, item_type: itemValue })}
        >
        <Picker.Item label="Producto" value="product" />
        <Picker.Item label="Servicio" value="service" />
        </Picker>
      <TextInput
        style={styles.input}
        placeholder="Stock"
        value={form.stock}
        keyboardType="numeric"
        onChangeText={(text) => setForm({ ...form, stock: text })}
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Actualizar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Eliminar Producto/Servicio</Text>
      </TouchableOpacity>
      <Button title="Cancelar" onPress={() => router.push('./ProductsServicesScreen')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#FF3333',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
