// app/statuses/create.tsx
import React, { useState, useContext, useEffect } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusesContext } from '@/contexts/StatusesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { StatusColorPalette } from '@/constants/Colors';

export default function CreateStatus() {
  const router = useRouter();
  const { addStatus } = useContext(StatusesContext);
  const { permissions } = useContext(PermissionsContext);
  const { completeSelection, cancelSelection } = usePendingSelection();

  const [label, setLabel] = useState('');
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
  }, [permissions, router]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);

  const handleSubmit = async () => {
    if (!label || !backgroundColor || orderIndex === '') {
      Alert.alert('Error', 'Completa todos los campos requeridos.');
      return;
    }
    setLoading(true);
    const newStatus = await addStatus({
      label,
      background_color: backgroundColor,
      order_index: parseInt(orderIndex, 10),
    });
    setLoading(false);
    if (newStatus) {
      Alert.alert('Éxito', 'Estado creado correctamente.');
      completeSelection(newStatus.id.toString());
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear el estado.');
    }
  };

  const normalizedBackgroundColor = backgroundColor.trim().toLowerCase();
  const paletteColors = StatusColorPalette;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
      <ThemedText style={styles.label}>Etiqueta</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Etiqueta del estado"
        value={label}
        onChangeText={setLabel}
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
      <ThemedText style={styles.helperText}>Seleccioná un color de la paleta o ingresá uno personalizado.</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.paletteScroll}
        keyboardShouldPersistTaps="handled"
      >
        {paletteColors.map((color, index) => {
          const isSelected = normalizedBackgroundColor === color.toLowerCase();
          return (
            <TouchableOpacity
              key={color}
              style={[styles.paletteItem, index === paletteColors.length - 1 && styles.lastPaletteItem]}
              onPress={() => setBackgroundColor(color)}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar color ${color}`}
            >
              <ThemedView
                style={[
                  styles.paletteSwatch,
                  {
                    backgroundColor: color,
                    borderColor: isSelected ? buttonColor : '#ffffff',
                    borderWidth: isSelected ? 3 : 1,
                  },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.previewRow}>
        <ThemedText style={styles.previewLabel}>Vista previa:</ThemedText>
        <ThemedView
          style={[styles.previewSwatch, { backgroundColor: backgroundColor || '#ffffff', borderColor }]}
          accessibilityLabel={`Color seleccionado ${backgroundColor}`}
        />
      </View>

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
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  helperText: { marginBottom: 12, fontSize: 14 },
  paletteScroll: { paddingVertical: 4, paddingRight: 4 },
  paletteItem: { marginRight: 12 },
  lastPaletteItem: { marginRight: 0 },
  paletteSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderColor: '#ffffff',
  },
  previewRow: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewLabel: { fontSize: 14, marginRight: 12 },
  previewSwatch: {
    width: 48,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
  },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
