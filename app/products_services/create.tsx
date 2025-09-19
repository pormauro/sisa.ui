// C:/Users/Mauri/Documents/GitHub/router/app/products_services/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ProductsServicesContext } from '@/contexts/ProductsServicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

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

  const backgroundColor = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const radioBorderColor = useThemeColor({ light: '#007BFF', dark: '#6a9cff' }, 'tint');
  const radioSelectedBackground = useThemeColor({ light: '#007BFF22', dark: '#6a9cff33' }, 'background');

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
    <ScrollView style={{ flex: 1, backgroundColor }} contentContainerStyle={styles.container}>
      <ThemedText style={styles.label}>Imagen</ThemedText>
      <CircleImagePicker
        fileId={productImageFileId}
        editable={true}
        size={200}
        onImageChange={setProductImageFileId}
      />

      <ThemedText style={styles.label}>Descripción</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Descripción"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Categoría</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={category}
        onChangeText={setCategory}
        placeholder="Categoría"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Precio</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        placeholder="Precio"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Costo</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        keyboardType="decimal-pad"
        value={cost}
        onChangeText={setCost}
        placeholder="Costo"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Dificultad</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={difficulty}
        onChangeText={setDifficulty}
        placeholder="Dificultad"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Tipo</ThemedText>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => setItemType('product')}
          style={[
            styles.radio,
            { borderColor: radioBorderColor },
            itemType === 'product' ? { backgroundColor: radioSelectedBackground } : {},
          ]}
        >
          <ThemedText>Producto</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setItemType('service')}
          style={[
            styles.radio,
            { borderColor: radioBorderColor },
            itemType === 'service' ? { backgroundColor: radioSelectedBackground } : {},
          ]}
        >
          <ThemedText>Servicio</ThemedText>
        </TouchableOpacity>
      </View>

      <ThemedText style={styles.label}>Stock (opcional)</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        keyboardType="numeric"
        value={stock}
        onChangeText={setStock}
        placeholder="Stock disponible"
        placeholderTextColor={placeholderColor}
      />

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  radio: { padding: 10, borderRadius: 8, borderWidth: 1 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
