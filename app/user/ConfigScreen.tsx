// app/user/ConfigScreen.tsx
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
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
  const [selectedTheme, setSelectedTheme] = useState<string>('light');

  useEffect(() => {
    // Cargamos la configuración (loadConfig se ejecuta al montar el provider, pero aquí se puede refrescar)
    loadConfig();
  }, []);

  useEffect(() => {
    if (configDetails?.theme) {
      setSelectedTheme(configDetails.theme);
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
  const inputTextColor = useThemeColor({}, 'text');

  const handleThemeChange = (value: string): void => {
    setSelectedTheme(value);
    if (configDetails) {
      const updated: ConfigForm = {
        role: configDetails.role,
        view_type: configDetails.view_type,
        theme: value,
        font_size: configDetails.font_size,
      };
      void updateConfig(updated);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.subtitle}>Configuración</ThemedText>
      {configDetails ? (
        <ThemedView style={styles.dataContainer} lightColor="#f5f5f5" darkColor="#1e1e1e">
          <ThemedText style={styles.infoText}>Tema</ThemedText>
          <Picker
            selectedValue={selectedTheme}
            onValueChange={handleThemeChange}
            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
          >
            <Picker.Item label="Claro" value="light" />
            <Picker.Item label="Oscuro" value="dark" />
          </Picker>
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
