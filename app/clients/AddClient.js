// app/clients/AddClient.js
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
import { BASE_URL } from '../config/index';

// Importamos el nuevo recurso
import CircleImagePicker from '../components/CircleImagePicker';

const EditClient = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    business_name: '',
    tax_id: '',
    email: '',
    brand_file_id: null,
    phone: '',
    address: '',
  });

  // Callback al actualizar la imagen (nueva fileId)  
  const handleImageUpdate = (newFileId) => {
    setForm({ ...form, brand_file_id: newFileId });
  };

  // Crear un nuevo cliente (POST)
  const handleSave = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${BASE_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Cliente creado');
        router.push('./ClientsScreen');
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
      <Text style={styles.title}>Agregar Cliente</Text>

      <CircleImagePicker
        fileId={form.brand_file_id}
        onImageChange={handleImageUpdate}
        editable={true}
        size={200}
      />

      <TextInput
        style={styles.input}
        placeholder="Razón Social"
        value={form.business_name}
        onChangeText={(text) => setForm({ ...form, business_name: text })}
      />
      <TextInput
        style={styles.input}
        placeholder="CUIT / Tax ID"
        value={form.tax_id}
        keyboardType="numeric"
        onChangeText={(text) => setForm({ ...form, tax_id: text })}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={form.email}
        keyboardType="email-address"
        onChangeText={(text) => setForm({ ...form, email: text })}
      />
      <TextInput
        style={styles.input}
        placeholder="Teléfono"
        value={form.phone}
        keyboardType="numeric"
        onChangeText={(text) => setForm({ ...form, phone: text })}
      />
      <TextInput
        style={styles.input}
        placeholder="Dirección"
        value={form.address}
        onChangeText={(text) => setForm({ ...form, address: text })}
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Crear</Text>
      </TouchableOpacity>

      <Button title="Cancelar" onPress={() => router.push('./ClientsScreen')} />
    </ScrollView>
  );
};

export default EditClient;

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
