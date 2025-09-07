// app/statuses/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusesContext } from '@/contexts/StatusesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function CreateStatus() {
  const router = useRouter();
  const { addStatus } = useContext(StatusesContext);
  const { permissions } = useContext(PermissionsContext);

  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [orderIndex, setOrderIndex] = useState('0');
  const [loading, setLoading] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  useEffect(() => {
    if (!permissions.includes('addStatus')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar estados.');
      router.back();
    }
  }, [permissions]);

  const handleSubmit = async () => {
    if (!label || !value || !backgroundColor || orderIndex === '') {
      Alert.alert('Error', 'Completa todos los campos requeridos.');
      return;
    }
    setLoading(true);
    const newStatus = await addStatus({
      label,
      value,
      background_color: backgroundColor,
      order_index: parseInt(orderIndex, 10),
    });
    setLoading(false);
    if (newStatus) {
      Alert.alert('Éxito', 'Estado creado correctamente.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el estado.');
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}>
      <ThemedText style={styles.label}>Etiqueta</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Etiqueta del estado"
        value={label}
        onChangeText={setLabel}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Valor</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Valor del estado"
        value={value}
        onChangeText={setValue}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Color de Fondo (HEX)</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="#ffffff"
        value={backgroundColor}
        onChangeText={setBackgroundColor}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Orden (Índice)</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Orden de visualización"
        value={orderIndex}
        keyboardType="numeric"
        onChangeText={setOrderIndex}
        placeholderTextColor={placeholderColor}
      />

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]} 
        onPress={handleSubmit} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear Estado</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
