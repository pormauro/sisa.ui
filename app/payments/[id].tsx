// app/payments/[id].tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { PaymentsContext } from '@/contexts/PaymentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toMySQLDateTime } from '@/utils/date';
import { getDisplayCategories } from '@/utils/categories';
import FileGallery from '@/components/FileGallery';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
  buildSelectionPath,
  CLEAR_SELECTION_VALUE,
  getSingleParamValue,
} from '@/utils/selection';

export default function PaymentDetailPage() {
  const { permissions } = useContext(PermissionsContext);
  const canEdit = permissions.includes('updatePayment');
  const canDelete = permissions.includes('deletePayment');

  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    creditorClientId?: string;
    chargeClientId?: string;
    creditorProviderId?: string;
  }>();
  const { id } = params;
  const paymentId = Number(id);
  const { payments, updatePayment, deletePayment } = useContext(PaymentsContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { categories } = useContext(CategoriesContext);
  const { providers } = useContext(ProvidersContext);
  const { clients } = useContext(ClientsContext);

  const payment = payments.find(p => p.id === paymentId);

  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [paidWithAccount, setPaidWithAccount] = useState('');
  const [creditorType, setCreditorType] =
    useState<'client' | 'provider' | 'other'>('provider');
  const [creditorClientId, setCreditorClientId] = useState('');
  const [creditorProviderId, setCreditorProviderId] = useState('');
  const [creditorOther, setCreditorOther] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [chargeClient, setChargeClient] = useState(false);
  const [chargeClientId, setChargeClientId] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const pickerBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const displayCategories = useMemo(
    () => getDisplayCategories(categories, 'expense'),
    [categories]
  );

  const creditorClientName = useMemo(() => {
    if (!creditorClientId) return 'Selecciona cliente';
    const found = clients.find(c => c.id === Number(creditorClientId));
    return found ? found.business_name : 'Cliente no encontrado';
  }, [clients, creditorClientId]);

  const creditorProviderName = useMemo(() => {
    if (!creditorProviderId) return 'Selecciona proveedor';
    const found = providers.find(p => p.id === Number(creditorProviderId));
    return found ? found.business_name : 'Proveedor no encontrado';
  }, [providers, creditorProviderId]);

  const chargeClientName = useMemo(() => {
    if (!chargeClientId) return 'Selecciona cliente';
    const found = clients.find(c => c.id === Number(chargeClientId));
    return found ? found.business_name : 'Cliente no encontrado';
  }, [clients, chargeClientId]);

  useEffect(() => {
    if (!canEdit && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para acceder a este pago.');
      router.back();
    }
  }, [permissions]);

  const creditorClientIdParam = getSingleParamValue(params.creditorClientId);
  const chargeClientIdParam = getSingleParamValue(params.chargeClientId);
  const creditorProviderIdParam = getSingleParamValue(params.creditorProviderId);

  useEffect(() => {
    if (creditorClientIdParam === undefined) return;
    if (creditorClientIdParam === CLEAR_SELECTION_VALUE) {
      setCreditorClientId('');
    } else if (creditorType === 'client') {
      setCreditorClientId(creditorClientIdParam);
    } else {
      setCreditorClientId(creditorClientIdParam);
    }
    router.replace({ pathname: `/payments/${paymentId}` });
  }, [creditorClientIdParam, router, paymentId, creditorType]);

  useEffect(() => {
    if (chargeClientIdParam === undefined) return;
    if (chargeClientIdParam === CLEAR_SELECTION_VALUE) {
      setChargeClientId('');
    } else if (chargeClient) {
      setChargeClientId(chargeClientIdParam);
    } else {
      setChargeClientId(chargeClientIdParam);
    }
    router.replace({ pathname: `/payments/${paymentId}` });
  }, [chargeClientIdParam, router, paymentId, chargeClient]);

  useEffect(() => {
    if (creditorProviderIdParam === undefined) return;
    if (creditorProviderIdParam === CLEAR_SELECTION_VALUE) {
      setCreditorProviderId('');
    } else if (creditorType === 'provider') {
      setCreditorProviderId(creditorProviderIdParam);
    } else {
      setCreditorProviderId(creditorProviderIdParam);
    }
    router.replace({ pathname: `/payments/${paymentId}` });
  }, [creditorProviderIdParam, router, paymentId, creditorType]);

  useEffect(() => {
    if (payment) {
      setPaymentDate(new Date(payment.payment_date.replace(' ', 'T')));
      setPaidWithAccount(payment.paid_with_account);
      setCreditorType(payment.creditor_type);
      setCreditorClientId(
        payment.creditor_client_id ? String(payment.creditor_client_id) : ''
      );
      setCreditorProviderId(
        payment.creditor_provider_id ? String(payment.creditor_provider_id) : ''
      );
      setCreditorOther(payment.creditor_other || '');
      setDescription(payment.description || '');
      const attachments = payment.attached_files
        ? (typeof payment.attached_files === 'string'
            ? JSON.parse(payment.attached_files)
            : payment.attached_files)
        : [];
      setAttachedFiles(attachments.length ? JSON.stringify(attachments) : '');
      setCategoryId(String(payment.category_id));
      setPrice(String(payment.price));
      setChargeClient(payment.charge_client);
      setChargeClientId(
        payment.client_id ? String(payment.client_id) : ''
      );
    }
  }, [payment]);


  const handleOpenProviderSelector = useCallback(() => {
    if (!canEdit) return;
    const path = buildSelectionPath('/providers', {
      selectedId: creditorProviderId,
      returnTo: `/payments/${paymentId}`,
      returnParam: 'creditorProviderId',
    });
    router.push(path);
  }, [canEdit, router, creditorProviderId, paymentId]);

  if (!payment) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}> 
        <ThemedText>Pago no encontrado</ThemedText>
      </ThemedView>
    );
  }

  const handleUpdate = () => {
    Alert.alert('Confirmar actualización', '¿Actualizar este pago?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Actualizar',
        onPress: async () => {
          setLoading(true);
          const success = await updatePayment(paymentId, {
            payment_date: toMySQLDateTime(paymentDate),
            paid_with_account: paidWithAccount,
            creditor_type: creditorType,
            creditor_client_id:
              creditorType === 'client' && creditorClientId
                ? parseInt(creditorClientId, 10)
                : null,
            creditor_provider_id:
              creditorType === 'provider' && creditorProviderId
                ? parseInt(creditorProviderId, 10)
                : null,
            creditor_other: creditorType === 'other' ? creditorOther : null,
            description,
            attached_files: attachedFiles || null,
            category_id: parseInt(categoryId, 10),
            price: parseFloat(price),
            charge_client: chargeClient,
            client_id:
              chargeClient && chargeClientId
                ? parseInt(chargeClientId, 10)
                : null,
          });
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Pago actualizado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo actualizar el pago');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Confirmar eliminación', '¿Eliminar este pago?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deletePayment(paymentId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Pago eliminado');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar el pago');
          }
        },
      },
    ]);
  };

  return (
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: screenBackground }]}> 
        <ThemedText style={styles.label}>Fecha y hora</ThemedText>
        <TouchableOpacity
          style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
          onPress={() => canEdit && setShowDatePicker(true)}
          disabled={!canEdit}
        >
          <ThemedText style={{ color: inputTextColor }}>{toMySQLDateTime(paymentDate)}</ThemedText>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={paymentDate}
            mode="date"
            display="default"
            onChange={(_, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const current = new Date(paymentDate);
                current.setFullYear(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth(),
                  selectedDate.getDate()
                );
                setPaymentDate(current);
                setShowTimePicker(true);
              }
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={paymentDate}
            mode="time"
            display="default"
            onChange={(_, selectedTime) => {
              setShowTimePicker(false);
              if (selectedTime) {
                const current = new Date(paymentDate);
                current.setHours(
                  selectedTime.getHours(),
                  selectedTime.getMinutes()
                );
                setPaymentDate(current);
              }
            }}
          />
        )}

        <ThemedText style={styles.label}>Cuenta utilizada</ThemedText>
        <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={paidWithAccount}
          onValueChange={setPaidWithAccount}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="-- Selecciona cuenta --" value="" />
          {cashBoxes.map(cb => (
            <Picker.Item key={cb.id} label={cb.name} value={cb.id.toString()} />
          ))}
        </Picker>
      </View>

      <ThemedText style={styles.label}>Tipo de acreedor</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={creditorType}
          onValueChange={(val) => setCreditorType(val as any)}
          style={[styles.picker, { color: inputTextColor }]}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="Cliente" value="client" />
          <Picker.Item label="Proveedor" value="provider" />
          <Picker.Item label="Otro" value="other" />
        </Picker>
      </View>

      {creditorType === 'client' && (
        <>
          <ThemedText style={styles.label}>Cliente</ThemedText>
          <TouchableOpacity
            style={[
              styles.input,
              styles.selectionInput,
              {
                backgroundColor: inputBackground,
                borderColor,
                opacity: canEdit ? 1 : 0.6,
              },
          ]}
          onPress={() => {
            if (!canEdit) return;
            const path = buildSelectionPath('/clients', {
              selectedId: creditorClientId,
              returnTo: `/payments/${paymentId}`,
              returnParam: 'creditorClientId',
            });
            router.push(path);
          }}
            disabled={!canEdit}
          >
            <ThemedText
              style={{
                color: creditorClientId ? inputTextColor : placeholderColor,
              }}
            >
              {creditorClientName}
            </ThemedText>
          </TouchableOpacity>
        </>
      )}

      {creditorType === 'provider' && (
        <>
          <ThemedText style={styles.label}>Proveedor</ThemedText>
          <TouchableOpacity
            style={[
              styles.input,
              styles.selectionInput,
              {
                backgroundColor: inputBackground,
                borderColor,
                opacity: canEdit ? 1 : 0.6,
              },
            ]}
            onPress={handleOpenProviderSelector}
            disabled={!canEdit}
          >
            <ThemedText
              style={{
                color: creditorProviderId ? inputTextColor : placeholderColor,
              }}
            >
              {creditorProviderId
                ? creditorProviderName
                : '-- Selecciona proveedor --'}
            </ThemedText>
          </TouchableOpacity>
        </>
      )}

      {creditorType === 'other' && (
        <>
          <ThemedText style={styles.label}>Acreedor</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
            value={creditorOther}
            onChangeText={setCreditorOther}
            placeholder="Nombre del acreedor"
            placeholderTextColor={placeholderColor}
          />
        </>
      )}

      <ThemedText style={styles.label}>Descripción</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={description}
        onChangeText={setDescription}
        editable={canEdit}
      />

      <ThemedText style={styles.label}>Categoría</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: pickerBackground }]}>
        <Picker
          selectedValue={categoryId}
          onValueChange={setCategoryId}
          style={[styles.picker, { color: inputTextColor }]}
          enabled={canEdit}
          dropdownIconColor={inputTextColor}
        >
          <Picker.Item label="-- Selecciona categoría --" value="" />
          {displayCategories.map(c => (
            <Picker.Item
              key={c.id}
              label={`${' '.repeat(c.level * 2)}${c.name}`}
              value={c.id.toString()}
            />
          ))}
        </Picker>
      </View>

      <ThemedText style={styles.label}>Precio</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor, borderColor }]}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        editable={canEdit}
      />

      <View style={styles.switchRow}>
        <ThemedText>Cobrar al cliente</ThemedText>
        <Switch value={chargeClient} onValueChange={setChargeClient} disabled={!canEdit} />
      </View>

      {chargeClient && (
        <>
          <ThemedText style={styles.label}>Cliente a cobrar</ThemedText>
          <TouchableOpacity
            style={[
              styles.input,
              styles.selectionInput,
              {
                backgroundColor: inputBackground,
                borderColor,
                opacity: canEdit ? 1 : 0.6,
              },
          ]}
          onPress={() => {
            if (!canEdit) return;
            const path = buildSelectionPath('/clients', {
              selectedId: chargeClientId,
              returnTo: `/payments/${paymentId}`,
              returnParam: 'chargeClientId',
            });
            router.push(path);
          }}
            disabled={!canEdit}
          >
            <ThemedText
              style={{
                color: chargeClientId ? inputTextColor : placeholderColor,
              }}
            >
              {chargeClientName}
            </ThemedText>
          </TouchableOpacity>
        </>
      )}

      <FileGallery filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} editable={canEdit} />

      {canEdit && (
        <TouchableOpacity style={[styles.submitButton, { backgroundColor: buttonColor }]} onPress={handleUpdate} disabled={loading}>
          {loading ? <ActivityIndicator color={buttonTextColor} /> : <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Actualizar</ThemedText>}
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>Eliminar</ThemedText>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginVertical: 8, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  selectionInput: {
    justifyContent: 'center',
  },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  picker: { height: 50, width: '100%' },
  submitButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButton: {
    marginTop: 16,
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});

