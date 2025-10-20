import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AfipPointsOfSaleContext } from '@/contexts/AfipPointsOfSaleContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const normaliseId = (value: string | string[] | undefined): number | null => {
  if (!value) {
    return null;
  }
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function EditAfipPointOfSaleModal() {
  const params = useLocalSearchParams<{ id?: string }>();
  const pointId = normaliseId(params.id);
  const isEditing = pointId !== null;

  const { points, createPoint } = useContext(AfipPointsOfSaleContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();

  const existingPoint = useMemo(() => points.find(point => point.id === pointId) ?? null, [pointId, points]);

  const [pointNumber, setPointNumber] = useState('');
  const [receiptType, setReceiptType] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
  const borderColor = useThemeColor({ light: '#d1d5db', dark: '#4b5563' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const canCreate = permissions.includes('createAfipPointOfSale');
  const canUpdate = permissions.includes('updateAfipPointOfSale');

  useEffect(() => {
    if (isEditing && !existingPoint) {
      Alert.alert('Punto de venta no disponible', 'No encontramos el punto de venta seleccionado.');
      router.back();
    }
  }, [existingPoint, isEditing, router]);

  useEffect(() => {
    if (isEditing && !canUpdate) {
      Alert.alert('Permiso insuficiente', 'No tienes permiso para editar puntos de venta AFIP.');
      router.back();
    }
    if (!isEditing && !canCreate) {
      Alert.alert('Permiso insuficiente', 'No tienes permiso para crear puntos de venta AFIP.');
      router.back();
    }
  }, [canCreate, canUpdate, isEditing, router]);

  useEffect(() => {
    if (existingPoint) {
      setPointNumber(existingPoint.point_number.toString());
      setReceiptType(existingPoint.receipt_type ?? '');
      setAddress(existingPoint.address ?? '');
      setDescription(existingPoint.description ?? '');
    }
  }, [existingPoint]);

  const validate = useCallback((): number | null => {
    if (!pointNumber.trim()) {
      Alert.alert('Datos incompletos', 'El número de punto de venta es obligatorio.');
      return null;
    }

    const numericPoint = Number(pointNumber.trim());
    if (!Number.isFinite(numericPoint) || numericPoint <= 0) {
      Alert.alert('Dato inválido', 'El número de punto de venta debe ser un número mayor a cero.');
      return null;
    }

    if (!receiptType.trim()) {
      Alert.alert('Datos incompletos', 'Selecciona el tipo de comprobante habilitado.');
      return null;
    }

    if (!address.trim()) {
      Alert.alert('Datos incompletos', 'Debes informar el domicilio del punto de venta.');
      return null;
    }

    return numericPoint;
  }, [address, pointNumber, receiptType]);

  const handleSubmit = useCallback(async () => {
    const numericPoint = validate();
    if (numericPoint === null) {
      return;
    }

    setSaving(true);
    const payload = {
      ...(isEditing ? { id: pointId ?? undefined } : {}),
      point_number: numericPoint,
      receipt_type: receiptType.trim(),
      address: address.trim(),
      description: description.trim() ? description.trim() : undefined,
      ...(existingPoint ? { active: existingPoint.active } : {}),
    };

    const result = await createPoint(payload);
    setSaving(false);

    if (result) {
      Alert.alert('Éxito', `Punto de venta ${isEditing ? 'actualizado' : 'creado'} correctamente.`, [
        {
          text: 'Aceptar',
          onPress: () => router.back(),
        },
      ]);
    }
  }, [address, createPoint, description, existingPoint, isEditing, pointId, receiptType, router, validate]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ThemedView style={[styles.container, { backgroundColor: background }]}> 
        <ScrollView
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContainer}
        >
          <ThemedText style={styles.title}>
            {isEditing ? 'Editar punto de venta AFIP' : 'Nuevo punto de venta AFIP'}
          </ThemedText>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Número de punto</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              placeholder="Ej: 0002"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              value={pointNumber}
              onChangeText={setPointNumber}
              maxLength={5}
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Tipo de comprobante habilitado</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              placeholder="Ej: Facturas A, B"
              placeholderTextColor={placeholderColor}
              value={receiptType}
              onChangeText={setReceiptType}
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Domicilio</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              placeholder="Dirección fiscal"
              placeholderTextColor={placeholderColor}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Descripción</ThemedText>
            <TextInput
              style={[styles.input, styles.multilineInput, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
              placeholder="Notas internas o referencia"
              placeholderTextColor={placeholderColor}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: buttonColor }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={buttonTextColor} />
            ) : (
              <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>
                {isEditing ? 'Guardar cambios' : 'Crear punto de venta'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  scrollContainer: {
    paddingBottom: 60,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
