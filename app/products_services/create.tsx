// C:/Users/Mauri/Documents/GitHub/router/app/products_services/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ProductsServicesContext } from '@/contexts/ProductsServicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';

export default function CreateProductService() {
  const router = useRouter();
  const { addProductService, loadProductsServices } = useContext(ProductsServicesContext);
  const { permissions } = useContext(PermissionsContext);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [itemType, setItemType] = useState<'product' | 'service'>('product');
  const [stock, setStock] = useState('');
  const [productImageFileId, setProductImageFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissions.includes('addProductService')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear productos o servicios.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
  /*  if (!description || !category || !price || !cost || !difficulty || !itemType) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios.');
      return;
    }*/
    setLoading(true);
    const newItem = await addProductService({
      description,
      category,
      price: parseFloat(price),
      cost: parseFloat(cost),
      difficulty,
      item_type: itemType,
      stock: stock ? parseInt(stock) : null,
      product_image_file_id: productImageFileId,
    });
    await loadProductsServices();
    setLoading(false);
    if (newItem) {
      Alert.alert('Éxito', 'Producto/servicio creado correctamente.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el producto/servicio.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Imagen</Text>
      <CircleImagePicker 
        fileId={productImageFileId} 
        editable={true} 
        size={200} 
        onImageChange={setProductImageFileId} 
      />

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Descripción" />

      <Text style={styles.label}>Categoría</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Categoría" />

      <Text style={styles.label}>Precio</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="Precio" />

      <Text style={styles.label}>Costo</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={cost} onChangeText={setCost} placeholder="Costo" />

      <Text style={styles.label}>Dificultad</Text>
      <TextInput style={styles.input} value={difficulty} onChangeText={setDifficulty} placeholder="Dificultad" />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => setItemType('product')} style={[styles.radio, itemType === 'product' && styles.radioSelected]}><Text>Producto</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setItemType('service')} style={[styles.radio, itemType === 'service' && styles.radioSelected]}><Text>Servicio</Text></TouchableOpacity>
      </View>

      <Text style={styles.label}>Stock (opcional)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={stock} onChangeText={setStock} placeholder="Stock disponible" />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Crear</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  radio: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#007BFF' },
  radioSelected: { backgroundColor: '#007BFF22' },
  submitButton: { marginTop: 16, backgroundColor: '#28a745', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});