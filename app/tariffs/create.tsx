// app/tariffs/create.tsx
import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TariffsContext } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { useCachedState } from '@/hooks/useCachedState';

export default function CreateTariff() {
  const router = useRouter();
  const { addTariff } = useContext(TariffsContext);
  const { permissions } = useContext(PermissionsContext);
  const { completeSelection, cancelSelection } = usePendingSelection();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draft, setDraft, draftHydrated] = useCachedState<{ name: string; amount: string } | null>(
    'drafts.tariffs.create',
    null
  );
  const draftAppliedRef = useRef(false);

  useEffect(() => {
    if (!permissions.includes('addTariff')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar tarifas.');
      router.back();
    }
  }, [permissions, router]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);

  useEffect(() => {
    if (!draftHydrated || draftAppliedRef.current) {
      return;
    }
    draftAppliedRef.current = true;
    if (draft) {
      setName(draft.name);
      setAmount(draft.amount);
    }
    setDraftReady(true);
  }, [draft, draftHydrated]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }
    setDraft({ name, amount });
  }, [amount, draftReady, name, setDraft]);

  const handleSubmit = async () => {
    if (!name || !amount) {
      Alert.alert('Error', 'Completa todos los campos.');
      return;
    }
    setLoading(true);
    const newTariff = await addTariff({ name, amount: parseFloat(amount) });
    setLoading(false);
    if (newTariff) {
      Alert.alert('Éxito', 'Tarifa creada.');
      setDraft(null);
      completeSelection(newTariff.id.toString());
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear la tarifa.');
    }
  };

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: background }]}
    >
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="Nombre de la tarifa"
        placeholderTextColor={placeholderColor}
        value={name}
        onChangeText={setName}
      />

      <ThemedText style={styles.label}>Monto</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="Monto"
        placeholderTextColor={placeholderColor}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear Tarifa</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
