// app/user/ConfigScreen.tsx
import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Button, Alert, TextInput, TouchableOpacity } from 'react-native';
import { ConfigContext, ConfigForm } from '@/contexts/ConfigContext';
import globalStyles from '@/styles/GlobalStyles';

const ConfigScreen: React.FC = () => {
  const { configDetails, loadConfig, updateConfig } = useContext(ConfigContext)!;
  const [editConfig, setEditConfig] = useState<boolean>(false);
  const [configForm, setConfigForm] = useState<ConfigForm>({
    role: '',
    view_type: '',
    theme: '',
    font_size: '',
  });

  useEffect(() => {
    // Cargamos la configuración (loadConfig se ejecuta al montar el provider, pero aquí se puede refrescar)
    loadConfig();
  }, []);

  useEffect(() => {
    if (configDetails) {
      setConfigForm({
        role: configDetails.role || '',
        view_type: configDetails.view_type || '',
        theme: configDetails.theme || '',
        font_size: configDetails.font_size || '',
      });
    }
  }, [configDetails]);

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
              <Button
                title="Guardar Configuración"
                onPress={() => {
                  void updateConfig(configForm);
                  setEditConfig(false);
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.infoText}>Rol: {configDetails.role}</Text>
              <Text style={styles.infoText}>Tipo de vista: {configDetails.view_type}</Text>
              <Text style={styles.infoText}>Tema: {configDetails.theme}</Text>
              <Text style={styles.infoText}>Tamaño de fuente: {configDetails.font_size}</Text>
              <TouchableOpacity style={styles.editButton} onPress={() => setEditConfig(true)}>
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
};

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

export default ConfigScreen;
