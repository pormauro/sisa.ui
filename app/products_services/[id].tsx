// C:/Users/Mauri/Documents/GitHub/router/app/products_services/[id].tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProductsServicesContext } from '@/contexts/ProductsServicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';

export default function ProductServiceDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const { productsServices, loadProductsServices, updateProductService, deleteProductService } = useContext(ProductsServicesContext);
  const { permissions } = useContext(PermissionsContext);

  const [loading, setLoading] = useState(false);
  const item = productsServices.find(p => p.id === itemId);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [itemType, setItemType] = useState<'product' | 'service'>('product');
  const [stock, setStock] = useState('');
  const [productImageFileId, setProductImageFileId] = useState<string | null>(null);

  const canEdit = permissions.includes('updateProductService');
  const canDelete = permissions.includes('deleteProductService');

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    if (!item) {
      Alert.alert('Error', 'Producto o servicio no encontrado.');
      router.back();
    } else {
      setDescription(item.description);
      setCategory(item.category);
      setPrice(String(item.price));
      setCost(String(item.cost));
      setDifficulty(item.difficulty);
      setItemType(item.item_type);
      setStock(item.stock?.toString() || '');
      setProductImageFileId(item.product_image_file_id);
    }
  }, [item]);

  const handleUpdate = () => {
  /*  if (!description || !category || !price || !cost || !difficulty || !itemType) {
      Alert.alert('Error', 'Completa todos los campos obligatorios.');
      return;
    }*/
    Alert.alert('Actualizar', '¿Actualizar este ítem?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updateProductService(itemId, {
            description,
            category,
            price: parseFloat(price),
            cost: parseFloat(cost),
            difficulty,
            item_type: itemType,
            stock: stock ? parseInt(stock) : null,
            product_image_file_id: productImageFileId
          });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Actualizado correctamente.');
            await loadProductsServices(); 
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar.');
          }
        }
      }
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Eliminar', '¿Eliminar este ítem?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          setLoading(true);
          const success = await deleteProductService(itemId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Eliminado correctamente.');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar.');
          }
        }
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Imagen</Text>
      <CircleImagePicker fileId={productImageFileId} editable={true} size={200} onImageChange={setProductImageFileId} />

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

      {canEdit && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUpdate}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Actualizar</Text>}
        </TouchableOpacity>
      )}

      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Eliminar</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  radio: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#007BFF' },
  radioSelected: { backgroundColor: '#007BFF22' },
  submitButton: { marginTop: 16, backgroundColor: '#007BFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
