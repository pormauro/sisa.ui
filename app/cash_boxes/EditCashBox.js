// app/cash_boxes/EditCashBox.js
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
import CircleImagePicker from '../../src/components/CircleImagePicker';

export default function EditCashBox() {
  const router = useRouter();
  const route = useRoute();
  const { id } = route.params; // ID de la caja

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    image_file_id: null,
  });

  const loadCashBox = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${BASE_URL}/cash_boxes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const cashBox = data.cash_box;
        setForm({
          name: cashBox.name || '',
          image_file_id: cashBox.image_file_id,
        });
      } else {
        Alert.alert('Error', 'No se pudo obtener la información de la caja');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadCashBox();
  }, [id]);

  const handleImageUpdate = (newFileId) => {
    setForm({ ...form, image_file_id: newFileId });
  };

  const handleSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const url = `${BASE_URL}/cash_boxes/${id}`;
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        Alert.alert('Éxito', 'Caja actualizada');
        router.push('./CashBoxesScreen');
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
      '¿Estás seguro de eliminar esta caja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) return;
              const response = await fetch(`${BASE_URL}/cash_boxes/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Caja eliminada');
                router.push('./CashBoxesScreen');
              } else {
                const errData = await response.json();
                Alert.alert('Error', errData.error || 'Error eliminando la caja');
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
      <Text style={styles.title}>Editar Caja de Dinero</Text>

      <CircleImagePicker
        fileId={form.image_file_id}
        size={200}
        editable={true}
        onImageChange={handleImageUpdate}
      />

      <TextInput
        style={styles.input}
        placeholder="Nombre de la caja"
        value={form.name}
        onChangeText={(text) => setForm({ ...form, name: text })}
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Actualizar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Eliminar Caja</Text>
      </TouchableOpacity>
      <Button title="Cancelar" onPress={() => router.push('./CashBoxesScreen')} />
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
