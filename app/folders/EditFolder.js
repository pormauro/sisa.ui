// app/folders/EditFolder.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Button, ActivityIndicator } from 'react-native';
import { useRouter, useSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../src/config/index';

export default function EditFolder() {
  const router = useRouter();
  const { id } = useSearchParams();
  const [name, setName] = useState('');
  const [parentFolderId, setParentFolderId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cargar los datos de la carpeta
  const loadFolder = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/folders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const folder = data.folder;
        setName(folder.name);
        setParentFolderId(folder.parent_folder_id);
      } else {
        Alert.alert('Error', 'No se pudo obtener la carpeta.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadFolder();
    }
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre de la carpeta es requerido.');
      return;
    }
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/folders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          parent_folder_id: parentFolderId,
        }),
      });
      if (response.ok) {
        Alert.alert('Éxito', 'Carpeta actualizada.');
        router.back();
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error al actualizar la carpeta');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Editar Carpeta</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre de la carpeta"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="ID carpeta padre (opcional)"
        value={parentFolderId ? parentFolderId.toString() : ''}
        onChangeText={(text) => setParentFolderId(text ? Number(text) : null)}
      />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Actualizar Carpeta</Text>
      </TouchableOpacity>
      <Button title="Cancelar" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, padding: 10, marginVertical: 10, borderRadius: 5 },
  saveButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
  },
  saveButtonText: { color: '#fff', fontSize: 18 },
});
