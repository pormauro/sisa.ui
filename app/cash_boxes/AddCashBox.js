// app/cash_boxes/AddCashBox.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Button,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { BASE_URL } from '../../src/config/index';
import CircleImagePicker from '../../src/components/CircleImagePicker';

export default function AddCashBox() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    image_file_id: null,
  });

  const handleImageUpdate = (newFileId) => {
    setForm({ ...form, image_file_id: newFileId });
  };

  const handleSave = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${BASE_URL}/cash_boxes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Caja de dinero creada');
        router.push('./CashBoxesScreen');
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
      <Text style={styles.title}>Agregar Caja de Dinero</Text>

      <CircleImagePicker
        fileId={form.image_file_id}
        onImageChange={handleImageUpdate}
        editable={true}
        size={200}
      />

      <TextInput
        style={styles.input}
        placeholder="Nombre de la caja"
        value={form.name}
        onChangeText={(text) => setForm({ ...form, name: text })}
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Crear</Text>
      </TouchableOpacity>

      <Button title="Cancelar" onPress={() => router.push('./CashBoxesScreen')} />
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
    marginBottom: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
