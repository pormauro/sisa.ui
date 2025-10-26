// app/statuses/[id].tsx
import React, { useState, useContext, useEffect } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusesContext } from '@/contexts/StatusesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { StatusColorPalette } from '@/constants/Colors';

export default function EditStatus() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const statusId = Number(id);
  const { statuses, loadStatuses, updateStatus, deleteStatus } = useContext(StatusesContext);
  const { permissions } = useContext(PermissionsContext);
  const { completeSelection, cancelSelection } = usePendingSelection();

  const statusItem = statuses.find(s => s.id === statusId);

  const [label, setLabel] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [orderIndex, setOrderIndex] = useState('0');
  const [loading, setLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const canEdit = permissions.includes('updateStatus');
  const canDelete = permissions.includes('deleteStatus');

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este estado.');
      router.back();
    }
  }, [canDelete, canEdit, router]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);

  useEffect(() => {
    if (statusItem) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setLabel(statusItem.label);
      setBackgroundColor(statusItem.background_color);
      setOrderIndex(statusItem.order_index.toString());
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadStatuses()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [statusItem, hasAttemptedLoad, isFetchingItem, loadStatuses]);

  const normalizedBackgroundColor = backgroundColor.trim().toLowerCase();
  const paletteColors = StatusColorPalette;

  if (!statusItem) {
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
      >
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={buttonColor} />
        ) : (
          <ThemedText>Estado no encontrado.</ThemedText>
        )}
      </ScrollView>
    );
  }

  const handleUpdate = () => {
    if (!label || !backgroundColor || orderIndex === '') {
      Alert.alert('Error', 'Completa todos los campos requeridos.');
      return;
    }
    Alert.alert('Actualizar Estado', '¿Deseas actualizar este estado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updateStatus(statusId, {
            label,
            background_color: backgroundColor,
            order_index: parseInt(orderIndex, 10),
          });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Estado actualizado correctamente.');
            completeSelection(statusId.toString());
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar el estado.');
          }
        }
      }
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Eliminar Estado', '¿Deseas eliminar este estado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteStatus(statusId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Estado eliminado correctamente.');
            cancelSelection();
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar el estado.');
          }
        }
      }
    ]);
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
      <ThemedText style={styles.label}>Etiqueta</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={label}
        onChangeText={setLabel}
        placeholder="Etiqueta"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Color de Fondo (HEX)</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={backgroundColor}
        onChangeText={setBackgroundColor}
        placeholder="#ffffff"
        placeholderTextColor={placeholderColor}
      />
      <ThemedText style={styles.helperText}>Elegí un color de la paleta o ingresá uno personalizado.</ThemedText>
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
        value={orderIndex}
        keyboardType="numeric"
        onChangeText={setOrderIndex}
        placeholder="Orden"
        placeholderTextColor={placeholderColor}
      />

      {canEdit && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar Estado</ThemedText>
          )}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.deleteButtonText}>Eliminar Estado</ThemedText>
          )}
        </TouchableOpacity>
      )}
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
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
