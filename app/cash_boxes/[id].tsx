// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/[id].tsx
import React, { useState, useContext, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { FORM_BOTTOM_SPACING } from '@/styles/formSpacing';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { ReceiptsContext } from '@/contexts/ReceiptsContext';
import { PaymentsContext } from '@/contexts/PaymentsContext';
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
  const { cashBoxes, loadCashBoxes, updateCashBox, deleteCashBox, listCashBoxHistory } = useContext(CashBoxesContext);
  const { receipts, loadReceipts } = useContext(ReceiptsContext);
  const { payments, loadPayments } = useContext(PaymentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { completeSelection, cancelSelection } = usePendingSelection();
  const { hasPrivilegedAccess } = useCompanyAdminPrivileges();
  const [name, setName] = useState('');
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);

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

  useEffect(() => {
    if (!cashBoxId || !Number.isFinite(cashBoxId)) {
      setHistoryEntries([]);
      return;
    }

    void listCashBoxHistory(cashBoxId).then(setHistoryEntries);
  }, [cashBoxId, listCashBoxHistory]);

  useEffect(() => {
    void loadReceipts();
    void loadPayments();
  }, [loadPayments, loadReceipts]);

  const cashBoxReceipts = receipts.filter(item => String(item.paid_in_account) === String(cashBoxId));
  const cashBoxPayments = payments.filter(item => String(item.paid_with_account) === String(cashBoxId));

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

      <View style={[styles.infoCard, { borderColor }]}> 
        <ThemedText style={styles.label}>Accesos contables</ThemedText>
        <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={() => router.push(`/accounting/summary?cash_box_id=${cashBoxId}`)}>
          <ThemedText>Ver resumen contable</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={() => router.push(`/closings/create?cash_box_id=${cashBoxId}`)}>
          <ThemedText>Nuevo cierre</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={[styles.infoCard, { borderColor }]}> 
        <ThemedText style={styles.label}>Movimientos de caja</ThemedText>
        {cashBoxReceipts.length === 0 && cashBoxPayments.length === 0 ? <ThemedText style={{ color: placeholderColor }}>Sin movimientos contables visibles para esta caja.</ThemedText> : null}
        {cashBoxReceipts.map((item, index) => (
          <View key={`cashbox-receipt-${index}`} style={styles.infoRow}>
            <ThemedText>{`Ingreso #${item.id} - ${item.price}`}</ThemedText>
            <ThemedText>{item.receipt_date}</ThemedText>
            <ThemedText style={{ color: placeholderColor }}>{item.description || 'Recibo'}</ThemedText>
          </View>
        ))}
        {cashBoxPayments.map((item, index) => (
          <View key={`cashbox-payment-${index}`} style={styles.infoRow}>
            <ThemedText>{`Egreso #${item.id} - ${item.price}`}</ThemedText>
            <ThemedText>{item.payment_date}</ThemedText>
            <ThemedText style={{ color: placeholderColor }}>{item.description || 'Pago'}</ThemedText>
          </View>
        ))}
      </View>

      <View style={[styles.infoCard, { borderColor }]}> 
        <ThemedText style={styles.label}>Historial</ThemedText>
        {historyEntries.length === 0 ? <ThemedText style={{ color: placeholderColor }}>Sin historial disponible.</ThemedText> : null}
        {historyEntries.slice(0, 8).map((entry, index) => (
          <View key={`cashbox-history-${index}`} style={styles.infoRow}>
            <ThemedText>{String(entry.operation_type ?? entry.action_type ?? 'UPDATE')}</ThemedText>
            <ThemedText>{String(entry.changed_at ?? entry.updated_at ?? entry.created_at ?? '')}</ThemedText>
          </View>
        ))}
      </View>

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
  container: { padding: 16, paddingBottom: FORM_BOTTOM_SPACING, flexGrow: 1 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  helperText: { marginBottom: 12, fontSize: 12 },
  infoCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, gap: 8 },
  infoRow: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#99999933', gap: 2 },
  secondaryButton: { borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
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
