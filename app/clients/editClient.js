// app/clients/editClient.js
import React, { useEffect, useState } from 'react';
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

// Importamos el CircleImagePicker
import CircleImagePicker from '../../src/components/CircleImagePicker';

export default function EditClient() {
  const router = useRouter();
  const route = useRoute();
  const { id } = route.params; // id del cliente

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    tax_id: '',
    email: '',
    brand_file_id: null,
    phone: '',
    address: '',
  });

  // Cargar datos del cliente en modo edición
  const loadClient = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${BASE_URL}/clients/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const client = data.client;
        setForm({
          business_name: client.business_name || '',
          tax_id: client.tax_id || '',
          email: client.email || '',
          brand_file_id: client.brand_file_id,
          phone: client.phone || '',
          address: client.address || '',
        });
      } else {
        Alert.alert('Error', 'No se pudo obtener la información del cliente');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadClient();
    }
  }, [id]);

  // Callback cuando se suba una nueva imagen
  const handleImageUpdate = (newFileId) => {
    // Actualizamos el brand_file_id en nuestro formulario
    setForm({ ...form, brand_file_id: newFileId });
  };

  // Guardar cambios
  const handleSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const url = id ? `${BASE_URL}/clients/${id}` : `${BASE_URL}/clients`;
    const method = id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        Alert.alert('Éxito', id ? 'Cliente actualizado' : 'Cliente creado');
        router.push('./ClientsScreen');
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error al guardar');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Eliminar cliente
  const handleDelete = async () => {
    if (!id) return;
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de eliminar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) return;
              const response = await fetch(`${BASE_URL}/clients/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Cliente eliminado');
                router.push('./ClientsScreen');
              } else {
                const errData = await response.json();
                Alert.alert('Error', errData.error || 'Error eliminando el cliente');
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
      <Text style={styles.title}>{id ? 'Editar Cliente' : 'Agregar Cliente'}</Text>

      {/* USO de CircleImagePicker con tamaño 120 y editable */}
      <CircleImagePicker
        fileId={form.brand_file_id}
        size={200}
        editable={true}
        onImageChange={handleImageUpdate}
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
        <Text style={styles.saveButtonText}>{id ? 'Actualizar' : 'Crear'}</Text>
      </TouchableOpacity>
      {id && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Eliminar Cliente</Text>
        </TouchableOpacity>
      )}
      <Button title="Cancelar" onPress={() => router.push('./ClientsScreen')} />
    </ScrollView>
  );
};

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
    marginBottom: 10,
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
    marginBottom: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
