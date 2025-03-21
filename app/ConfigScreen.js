// app/config.js (o app/config/index.js)

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Button,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { BASE_URL } from './config/index';

export default function ConfigScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState(null);

  // Datos de configuración
  const [configDetails, setConfigDetails] = useState(null);

  // Modo edición
  const [editConfig, setEditConfig] = useState(false);

  // Formulario
  const [configForm, setConfigForm] = useState({
    role: '',
    view_type: '',
    theme: '',
    font_size: '',
  });

  // Cargar userId de AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('user_id');
        if (storedUserId) setUserId(storedUserId);
      } catch (error) {
        console.log('Error al cargar user_id:', error);
      }
    };
    loadUserData();
  }, []);

  // Cargar configuración
  const loadConfig = async () => {
    if (!userId) return;
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    try {
      const configResponse = await fetch(
        `${BASE_URL}/user_configurations/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (configResponse.ok) {
        const configData = await configResponse.json();
        const configuration = configData.configuration;
        setConfigDetails(configuration);
        setConfigForm({
          role: configuration.role || '',
          view_type: configuration.view_type || '',
          theme: configuration.theme || '',
          font_size: configuration.font_size || '',
        });
      } else {
        console.error('Error al obtener la configuración');
      }
    } catch (error) {
      console.error('Error en fetch de configuración:', error);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [userId]);

  // Guardar cambios en configuración (PUT)
  const handleConfigSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/user_configurations`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: configForm.role,
          view_type: configForm.view_type,
          theme: configForm.theme,
          font_size: configForm.font_size,
        }),
      });
      if (response.ok) {
        setConfigDetails({ ...configDetails, ...configForm });
        setEditConfig(false);
      } else {
        const errData = await response.json();
        Alert.alert('Error', errData.error || 'Error actualizando configuración');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.subtitle}>Configuración</Text>

      {configDetails ? (
        <View style={styles.dataContainer}>
          {editConfig ? (
            <>
              <TextInput
                style={styles.input}
                value={configForm.role}
                onChangeText={(text) => setConfigForm({ ...configForm, role: text })}
                placeholder="Rol"
              />
              <TextInput
                style={styles.input}
                value={configForm.view_type}
                onChangeText={(text) => setConfigForm({ ...configForm, view_type: text })}
                placeholder="Tipo de vista"
              />
              <TextInput
                style={styles.input}
                value={configForm.theme}
                onChangeText={(text) => setConfigForm({ ...configForm, theme: text })}
                placeholder="Tema"
              />
              <TextInput
                style={styles.input}
                value={configForm.font_size}
                onChangeText={(text) => setConfigForm({ ...configForm, font_size: text })}
                placeholder="Tamaño de fuente"
              />
              <Button title="Guardar Configuración" onPress={handleConfigSave} />
            </>
          ) : (
            <>
              <Text style={styles.infoText}>Rol: {configDetails.role}</Text>
              <Text style={styles.infoText}>Tipo de vista: {configDetails.view_type}</Text>
              <Text style={styles.infoText}>Tema: {configDetails.theme}</Text>
              <Text style={styles.infoText}>Tamaño de fuente: {configDetails.font_size}</Text>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditConfig(true)}
              >
                <Text style={styles.editButtonText}>Editar Configuración</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <Text style={styles.infoText}>Cargando configuración...</Text>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  subtitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dataContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  infoText: { fontSize: 18, marginVertical: 5 },
  input: {
    borderWidth: 1,
    padding: 10,
    marginVertical: 8,
    borderRadius: 5,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  editButton: {
    backgroundColor: '#007BFF',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 18,
  },
});
