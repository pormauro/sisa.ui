// app/user/ConfigScreen.tsx
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ConfigContext, ConfigForm } from '@/contexts/ConfigContext';
import { FileContext } from '@/contexts/FilesContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const ConfigScreen: React.FC = () => {
  const { configDetails, loadConfig, updateConfig } = useContext(ConfigContext)!;
  const { clearLocalFiles } = useContext(FileContext);
  const [editConfig, setEditConfig] = useState<boolean>(false);
  const [configForm, setConfigForm] = useState<ConfigForm>({
    role: '',
    view_type: '',
    theme: 'light',
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
        theme: configDetails.theme || 'light',
        font_size: configDetails.font_size || '',
      });
    }
  }, [configDetails]);

  const handleClearFiles = (): void => {
    Alert.alert('Confirmación', '¿Deseas borrar los datos de los archivos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          void clearLocalFiles();
        },
      },
    ]);
  };

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');

  return (
    <ScrollView style={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.subtitle}>Configuración</ThemedText>
      {configDetails ? (
        <ThemedView style={styles.dataContainer} lightColor="#f5f5f5" darkColor="#1e1e1e">
          {editConfig ? (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground }]}
                value={configForm.role}
                onChangeText={(text) => setConfigForm({ ...configForm, role: text })}
                placeholder="Rol"
              />
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground }]}
                value={configForm.view_type}
                onChangeText={(text) => setConfigForm({ ...configForm, view_type: text })}
                placeholder="Tipo de vista"
              />
              <Picker
                selectedValue={configForm.theme}
                onValueChange={(value) => setConfigForm({ ...configForm, theme: value })}
                style={[styles.input, { backgroundColor: inputBackground }]}
              >
                <Picker.Item label="Claro" value="light" />
                <Picker.Item label="Oscuro" value="dark" />
              </Picker>
              <TextInput
                style={[styles.input, { backgroundColor: inputBackground }]}
                value={configForm.font_size}
                onChangeText={(text) => setConfigForm({ ...configForm, font_size: text })}
                placeholder="Tamaño de fuente"
              />
              <ThemedButton
                title="Guardar Configuración"
                onPress={() => {
                  void updateConfig(configForm);
                  setEditConfig(false);
                }}
              />
            </>
          ) : (
            <>
              <ThemedText style={styles.infoText}>Rol: {configDetails.role}</ThemedText>
              <ThemedText style={styles.infoText}>Tipo de vista: {configDetails.view_type}</ThemedText>
              <ThemedText style={styles.infoText}>
                Tema: {configDetails.theme === 'dark' ? 'Oscuro' : 'Claro'}
              </ThemedText>
              <ThemedText style={styles.infoText}>Tamaño de fuente: {configDetails.font_size}</ThemedText>
              <ThemedButton title="Editar Configuración" onPress={() => setEditConfig(true)} style={styles.editButton} />
            </>
          )}
          <ThemedButton
            title="Borrar datos de archivos"
            lightColor="#d9534f"
            darkColor="#d9534f"
            onPress={handleClearFiles}
            style={styles.editButton}
          />
        </ThemedView>
      ) : (
        <ThemedText style={styles.infoText}>Cargando configuración...</ThemedText>
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
  },
  editButton: { marginTop: 10 },
});

export default ConfigScreen;
