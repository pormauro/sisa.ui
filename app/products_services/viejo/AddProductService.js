// app/products_services/AddProductService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity
} from 'react-native';
import CircleImagePicker from '../../../src/components/CircleImagePicker';
import { BASE_URL } from '../../../src/config/index';

export default function AddProductService() {
  const router = useRouter();
  const [form, setForm] = useState({
    description: '',
    category: '',
    price: '',
    cost: '',
    difficulty: '',
    item_type: '', // Se espera "product" o "service"
    stock: '0',
    product_image_file_id: null,
  });

  const handleImageUpdate = (newFileId) => {
    setForm({ ...form, product_image_file_id: newFileId });
  };

  const handleSave = async () => {
    // Aquí podrías agregar validaciones de campos obligatorios
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      // Convertir price, cost y stock a números
      const payload = {
        ...form,
        price: parseFloat(form.price),
        cost: form.cost ? parseFloat(form.cost) : null,
        stock: parseInt(form.stock, 10),
      };

      const response = await fetch(`${BASE_URL}/products_services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Producto/Servicio creado');
        router.back();
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error al guardar');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Agregar Producto/Servicio</Text>

      <CircleImagePicker
        fileId={form.product_image_file_id}
        onImageChange={handleImageUpdate}
        editable={true}
        size={200}
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
        <Text style={styles.saveButtonText}>Crear</Text>
      </TouchableOpacity>

      <Button title="Cancelar" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
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
  label: {
    fontSize: 16,
    marginTop: 10,
  },
  picker: {
    height: 50,
    marginVertical: 5,
  },
});
