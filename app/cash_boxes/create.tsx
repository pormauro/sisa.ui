// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/create.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import ParticipantsBubbles from '@/components/ParticipantsBubbles';
import { AuthContext } from '@/contexts/AuthContext';

export default function CreateCashBox() {
  const router = useRouter();
  const { addCashBox, loadCashBoxes } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const { completeSelection, cancelSelection } = usePendingSelection();
  const { userId } = useContext(AuthContext);
  
  const [name, setName] = useState('');
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const defaultParticipantId = useMemo(() => {
    if (!userId) return null;
    const parsed = Number(userId);
    return Number.isNaN(parsed) ? null : parsed;
  }, [userId]);

  useEffect(() => {
    if (!permissions.includes('addCashBox')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear cajas.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => {
    return () => {
      cancelSelection();
    };
  }, [cancelSelection]);

  useEffect(() => {
    if (defaultParticipantId && !assignedUsers.length) {
      setAssignedUsers([defaultParticipantId]);
    }
  }, [defaultParticipantId, assignedUsers.length]);

  const handleSubmit = async () => {
    if (!name) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    setLoading(true);
    const newCashBox = await addCashBox({ name, image_file_id: imageFileId, assigned_user_ids: assignedUsers });
    await loadCashBoxes();
    setLoading(false);
    if (newCashBox) {
      completeSelection(newCashBox.id.toString());
      Alert.alert('Éxito', 'Caja creada exitosamente');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo crear la caja');
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}
    >
      <ThemedText style={styles.label}>Imagen de la Caja</ThemedText>
      <CircleImagePicker
        fileId={imageFileId}
        editable={true}
        size={200}
        onImageChange={(newId) => setImageFileId(newId)}
      />

      <ThemedText style={styles.label}>Nombre de la Caja</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        placeholder="Nombre de la caja"
        value={name}
        onChangeText={setName}
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Usuarios asignados</ThemedText>
      <ParticipantsBubbles
        participants={assignedUsers}
        onChange={setAssignedUsers}
      />
      <ThemedText style={[styles.helperText, { color: placeholderColor }]}>Los usuarios seleccionados recibirán notificaciones y podrán acceder a esta caja.</ThemedText>

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: buttonColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={buttonTextColor} />
        ) : (
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear Caja</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  helperText: { marginBottom: 12, fontSize: 12 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
