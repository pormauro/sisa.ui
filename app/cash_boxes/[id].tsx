// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/[id].tsx
import React, { useState, useContext, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CashBoxesContext, CashBox } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import ParticipantsBubbles from '@/components/ParticipantsBubbles';
import { useCompanyAdminPrivileges } from '@/hooks/useCompanyAdminPrivileges';

export default function CashBoxDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cashBoxId = Number(id);
  const { cashBoxes, loadCashBoxes, updateCashBox, deleteCashBox } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
  const { completeSelection, cancelSelection } = usePendingSelection();
  const { hasPrivilegedAccess } = useCompanyAdminPrivileges();
  const [name, setName] = useState('');
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<number[]>([]);
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

  const canEditPermission = permissions.includes('updateCashBox');
  const canDeletePermission = permissions.includes('deleteCashBox');
  const canEdit = canEditPermission && hasPrivilegedAccess;
  const canDelete = canDeletePermission && hasPrivilegedAccess;
  const showRestrictedActionAlert = useCallback(() => {
    Alert.alert(
      'Acción restringida',
      'Solo los administradores de la empresa o el usuario maestro pueden editar o eliminar cajas.'
    );
  }, []);

  const cashBox = cashBoxes.find(cb => cb.id === cashBoxId);

  useEffect(() => {
    if (!canEditPermission && !canDeletePermission) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a esta caja.');
      router.back();
      return;
    }

    if (!hasPrivilegedAccess && (canEditPermission || canDeletePermission)) {
      showRestrictedActionAlert();
    }
  }, [
    canDeletePermission,
    canEditPermission,
    hasPrivilegedAccess,
    router,
    showRestrictedActionAlert,
  ]);

  useEffect(() => {
    return () => {
      cancelSelection();
    };
  }, [cancelSelection]);

  useEffect(() => {
    if (cashBox) {
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setName(cashBox.name);
      setImageFileId(cashBox.image_file_id);
      setAssignedUsers(cashBox.assigned_user_ids ?? []);
      return;
    }

    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadCashBoxes()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [cashBox, hasAttemptedLoad, isFetchingItem, loadCashBoxes]);

  const handleUpdate = () => {
    if (!canEdit) {
      showRestrictedActionAlert();
      return;
    }
    if (!name) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    Alert.alert(
      'Actualizar',
      '¿Actualizar esta caja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Actualizar',
          onPress: async () => {
            setLoading(true);
            const success = await updateCashBox(cashBoxId, {
              name,
              image_file_id: imageFileId,
              assigned_user_ids: assignedUsers,
            });
            setLoading(false);
            if (success) {
              completeSelection(cashBoxId.toString());
              Alert.alert('Éxito', 'Caja actualizada');
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo actualizar la caja');
            }
          }
        }
      ]
    );
  };

  const handleDelete = () => {
    if (!canDelete) {
      showRestrictedActionAlert();
      return;
    }
    Alert.alert(
      'Eliminar',
      '¿Eliminar esta caja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          onPress: async () => {
            setLoading(true);
            const success = await deleteCashBox(cashBoxId);
            setLoading(false);
            if (success) {
              Alert.alert('Éxito', 'Caja eliminada');
              router.back();
            } else {
              Alert.alert('Error', 'No se pudo eliminar la caja');
            }
          }
        }
      ]
    );
  };

  if (!cashBox) {
    return (
      <View style={[styles.container, { backgroundColor: screenBackground }]}> 
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator color={buttonColor} />
        ) : (
          <ThemedText>Caja no encontrada</ThemedText>
        )}
      </View>
    );
  }

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
        value={name}
        onChangeText={setName}
        placeholder="Nombre de la caja"
        placeholderTextColor={placeholderColor}
      />

      <ThemedText style={styles.label}>Usuarios asignados</ThemedText>
      <ParticipantsBubbles
        participants={assignedUsers}
        onChange={canEdit ? setAssignedUsers : undefined}
        editable={canEdit}
      />
      <ThemedText style={[styles.helperText, { color: placeholderColor }]}>Los usuarios seleccionados recibirán notificaciones y podrán acceder a esta caja.</ThemedText>

      {canEditPermission && (
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: buttonColor },
            !canEdit && styles.disabledAction,
          ]}
          onPress={handleUpdate}
          disabled={loading || !canEdit}
        >
          {loading ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar Caja</ThemedText>
          )}
        </TouchableOpacity>
      )}

      {canDeletePermission && (
        <TouchableOpacity
          style={[styles.deleteButton, !canDelete && styles.disabledDeleteButton]}
          onPress={handleDelete}
          disabled={loading || !canDelete}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.deleteButtonText}>Eliminar Caja</ThemedText>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120, flexGrow: 1 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  helperText: { marginBottom: 12, fontSize: 12 },
  submitButton: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  deleteButton: { marginTop: 16, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  disabledAction: {
    opacity: 0.6,
  },
  disabledDeleteButton: {
    opacity: 0.7,
  },
});
