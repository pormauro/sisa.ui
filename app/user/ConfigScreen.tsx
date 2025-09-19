// app/user/ConfigScreen.tsx
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Alert, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConfigContext, ConfigForm } from '@/contexts/ConfigContext';
import { FileContext } from '@/contexts/FilesContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { clearAllDataCaches } from '@/utils/cache';

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

  const handleClearCache = (): void => {
    Alert.alert('Confirmación', '¿Deseas borrar los datos almacenados en caché?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          void clearAllDataCaches();
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
          <View style={styles.themeSelector}>
            <TouchableOpacity
              style={[
                styles.themeButton,
                { backgroundColor: inputBackground },
                selectedTheme === 'light' && styles.selectedThemeButton,
              ]}
              onPress={() => handleThemeChange('light')}
            >
              <Ionicons
                name="sunny"
                size={24}
                color={selectedTheme === 'light' ? inputTextColor : '#888'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeButton,
                { backgroundColor: inputBackground },
                selectedTheme === 'dark' && styles.selectedThemeButton,
              ]}
              onPress={() => handleThemeChange('dark')}
            >
              <Ionicons
                name="moon"
                size={24}
                color={selectedTheme === 'dark' ? inputTextColor : '#888'}
              />
            </TouchableOpacity>
          </View>
          <ThemedButton
            title="Borrar datos de archivos"
            lightColor="#d9534f"
            darkColor="#d9534f"
            onPress={handleClearFiles}
            style={styles.editButton}
          />
          <ThemedButton
            title="Borrar datos de la caché"
            lightColor="#d9534f"
            darkColor="#d9534f"
            onPress={handleClearCache}
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
  themeSelector: { flexDirection: 'row', marginVertical: 8 },
  themeButton: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedThemeButton: {
    borderColor: '#007AFF',
  },
  editButton: { marginTop: 10 },
});

export default ConfigScreen;
