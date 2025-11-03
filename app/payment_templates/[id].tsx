import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  PaymentTemplatesContext,
  PaymentTemplate,
} from '@/contexts/PaymentTemplatesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CategoriesContext } from '@/contexts/CategoriesContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { CashBoxesContext } from '@/contexts/CashBoxesContext';
import { ConfigContext } from '@/contexts/ConfigContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SearchableSelect } from '@/components/SearchableSelect';
import { RadioGroup } from '@/components/RadioGroup';
import IconSelector from '@/components/IconSelector';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';
import { PAYMENT_TEMPLATE_ICON_OPTIONS } from '@/constants/paymentTemplateIconOptions';

const NEW_CLIENT_VALUE = '__new_client__';
const NEW_PROVIDER_VALUE = '__new_provider__';
const NEW_CATEGORY_VALUE = '__new_category__';
const NEW_CASH_BOX_VALUE = '__new_cash_box__';

const creditorOptions = [
  { label: 'Cliente', value: 'client' },
  { label: 'Proveedor', value: 'provider' },
  { label: 'Otro', value: 'other' },
] as const;

type CreditorType = (typeof creditorOptions)[number]['value'];

type LocalTemplateState = {
  isInitialized: boolean;
  template: PaymentTemplate | null;
};

const INITIAL_STATE: LocalTemplateState = {
  isInitialized: false,
  template: null,
};

export default function EditPaymentTemplateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const { permissions } = useContext(PermissionsContext);
  const {
    paymentTemplates,
    loadPaymentTemplates,
    updatePaymentTemplate,
    deletePaymentTemplate,
  } = useContext(PaymentTemplatesContext);
  const { categories } = useContext(CategoriesContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const { cashBoxes } = useContext(CashBoxesContext);
  const { configDetails } = useContext(ConfigContext);
  const { beginSelection, consumeSelection, pendingSelections } = usePendingSelection();

  const [localState, setLocalState] = useState<LocalTemplateState>(INITIAL_STATE);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [defaultPaidWithAccount, setDefaultPaidWithAccount] = useState('');
  const [creditorType, setCreditorType] = useState<CreditorType>('provider');
  const [creditorClientId, setCreditorClientId] = useState('');
  const [creditorProviderId, setCreditorProviderId] = useState('');
  const [creditorOther, setCreditorOther] = useState('');
  const [chargeClient, setChargeClient] = useState(false);
  const [chargeClientId, setChargeClientId] = useState('');
  const [iconName, setIconName] = useState('');
  const [loading, setLoading] = useState(false);

  const canEdit = permissions.includes('updatePaymentTemplate');
  const canDelete = permissions.includes('deletePaymentTemplate');

  useEffect(() => {
    if (!permissions.includes('listPaymentTemplates')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver esta plantilla.');
      router.back();
      return;
    }
    if (!canEdit) {
      Alert.alert('Sin permisos', 'No tienes permiso para editar plantillas.');
    }
  }, [canEdit, permissions, router]);

  useEffect(() => {
    const existing = paymentTemplates.find(template => template.id === templateId) ?? null;
    if (existing) {
      setLocalState({ isInitialized: true, template: existing });
      setName(existing.name);
      setDescription(existing.description ?? '');
      setDefaultAmount(existing.default_amount?.toString() ?? '');
      setDefaultCategoryId(existing.default_category_id?.toString() ?? '');
      setDefaultPaidWithAccount(existing.default_paid_with_account ?? '');
      setCreditorType(existing.default_creditor_type ?? 'provider');
      setCreditorClientId(existing.default_creditor_client_id?.toString() ?? '');
      setCreditorProviderId(existing.default_creditor_provider_id?.toString() ?? '');
      setCreditorOther(existing.default_creditor_other ?? '');
      setChargeClient(Boolean(existing.default_charge_client));
      setChargeClientId(existing.default_charge_client_id?.toString() ?? '');
      setIconName(existing.icon_name ?? '');
      return;
    }

    if (!localState.isInitialized) {
      setLocalState(prev => ({ ...prev, isInitialized: true }));
      void loadPaymentTemplates();
    }
  }, [loadPaymentTemplates, localState.isInitialized, paymentTemplates, templateId]);

  const screenBackground = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const dangerColor = useThemeColor({ light: '#ff4d4f', dark: '#ff7072' }, 'button');

  useEffect(() => {
    if (defaultCategoryId) {
      return;
    }
    if (!categories.length) {
      return;
    }
    setDefaultCategoryId(categories[0].id.toString());
  }, [categories, defaultCategoryId]);

  useEffect(() => {
    if (defaultPaidWithAccount) {
      return;
    }
    const defaultCashBoxId = configDetails?.default_payment_cash_box_id;
    if (defaultCashBoxId === null || typeof defaultCashBoxId === 'undefined') {
      return;
    }
    setDefaultPaidWithAccount(defaultCashBoxId.toString());
  }, [configDetails, defaultPaidWithAccount]);

  const categoryItems = useMemo(
    () => [
      { label: '-- Selecciona categoría --', value: '' },
      { label: '➕ Nueva categoría', value: NEW_CATEGORY_VALUE },
      ...categories.map(category => ({ label: category.name, value: category.id.toString() })),
    ],
    [categories]
  );

  const clientItems = useMemo(
    () => [
      { label: '-- Selecciona cliente --', value: '' },
      { label: '➕ Nuevo cliente', value: NEW_CLIENT_VALUE },
      ...clients.map(client => ({ label: client.business_name, value: client.id.toString() })),
    ],
    [clients]
  );

  const providerItems = useMemo(
    () => [
      { label: '-- Selecciona proveedor --', value: '' },
      { label: '➕ Nuevo proveedor', value: NEW_PROVIDER_VALUE },
      ...providers.map(provider => ({ label: provider.business_name, value: provider.id.toString() })),
    ],
    [providers]
  );

  const cashBoxItems = useMemo(
    () => [
      { label: '-- Selecciona cuenta --', value: '' },
      { label: '➕ Nueva caja', value: NEW_CASH_BOX_VALUE },
      ...cashBoxes.map(cashBox => ({ label: cashBox.name, value: cashBox.id.toString() })),
    ],
    [cashBoxes]
  );

  useEffect(() => {
    const pendingCategory = pendingSelections[SELECTION_KEYS.paymentTemplates.category];
    if (pendingCategory === undefined || pendingCategory === null) {
      return;
    }
    const stringValue = String(pendingCategory);
    const exists = categories.some(category => category.id.toString() === stringValue);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.paymentTemplates.category);
    setDefaultCategoryId(stringValue);
  }, [pendingSelections, consumeSelection, categories]);

  useEffect(() => {
    const pendingCashBox = pendingSelections[SELECTION_KEYS.paymentTemplates.cashBox];
    if (pendingCashBox === undefined || pendingCashBox === null) {
      return;
    }
    const stringValue = String(pendingCashBox);
    const exists = cashBoxes.some(cashBox => cashBox.id.toString() === stringValue);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.paymentTemplates.cashBox);
    setDefaultPaidWithAccount(stringValue);
  }, [pendingSelections, consumeSelection, cashBoxes]);

  useEffect(() => {
    const pendingClient = pendingSelections[SELECTION_KEYS.paymentTemplates.creditorClient];
    if (pendingClient === undefined || pendingClient === null) {
      return;
    }
    const stringValue = String(pendingClient);
    const exists = clients.some(client => client.id.toString() === stringValue);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.paymentTemplates.creditorClient);
    setCreditorClientId(stringValue);
    setCreditorType('client');
  }, [pendingSelections, consumeSelection, clients]);

  useEffect(() => {
    const pendingProvider = pendingSelections[SELECTION_KEYS.paymentTemplates.creditorProvider];
    if (pendingProvider === undefined || pendingProvider === null) {
      return;
    }
    const stringValue = String(pendingProvider);
    const exists = providers.some(provider => provider.id.toString() === stringValue);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.paymentTemplates.creditorProvider);
    setCreditorProviderId(stringValue);
    setCreditorType('provider');
  }, [pendingSelections, consumeSelection, providers]);

  useEffect(() => {
    const pendingChargeClient = pendingSelections[SELECTION_KEYS.paymentTemplates.chargeClient];
    if (pendingChargeClient === undefined || pendingChargeClient === null) {
      return;
    }
    const stringValue = String(pendingChargeClient);
    const exists = clients.some(client => client.id.toString() === stringValue);
    if (!exists) {
      return;
    }
    consumeSelection(SELECTION_KEYS.paymentTemplates.chargeClient);
    setChargeClient(true);
    setChargeClientId(stringValue);
  }, [pendingSelections, consumeSelection, clients]);

  const handleSubmit = async () => {
    if (!canEdit) {
      Alert.alert('Sin permisos', 'No puedes editar esta plantilla.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Falta información', 'Ingresa un nombre para la plantilla.');
      return;
    }

    if (creditorType === 'client' && !creditorClientId) {
      Alert.alert('Falta información', 'Selecciona un cliente predeterminado.');
      return;
    }

    if (creditorType === 'provider' && !creditorProviderId) {
      Alert.alert('Falta información', 'Selecciona un proveedor predeterminado.');
      return;
    }

    if (creditorType === 'other' && !creditorOther.trim()) {
      Alert.alert('Falta información', 'Define el acreedor predeterminado.');
      return;
    }

    if (chargeClient && !chargeClientId) {
      Alert.alert('Falta información', 'Selecciona el cliente a cargar.');
      return;
    }

    setLoading(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      default_amount: defaultAmount ? Number(defaultAmount) : null,
      default_category_id: defaultCategoryId ? Number(defaultCategoryId) : null,
      default_paid_with_account: defaultPaidWithAccount || null,
      default_creditor_type: creditorType,
      default_creditor_client_id:
        creditorType === 'client' && creditorClientId ? Number(creditorClientId) : null,
      default_creditor_provider_id:
        creditorType === 'provider' && creditorProviderId ? Number(creditorProviderId) : null,
      default_creditor_other: creditorType === 'other' ? creditorOther.trim() || null : null,
      default_charge_client: chargeClient,
      default_charge_client_id: chargeClient && chargeClientId ? Number(chargeClientId) : null,
      icon_name: iconName || null,
    } as const;

    const result = await updatePaymentTemplate(templateId, payload);
    setLoading(false);
    if (!result) {
      Alert.alert('Error', 'No se pudo actualizar la plantilla. Inténtalo nuevamente.');
      return;
    }

    Alert.alert('Plantilla actualizada', 'Los cambios se guardaron correctamente.', [
      {
        text: 'Aceptar',
        onPress: () => router.replace('/payment_templates'),
      },
    ]);
  };

  const handleDelete = () => {
    if (!canDelete) {
      Alert.alert('Sin permisos', 'No puedes eliminar esta plantilla.');
      return;
    }

    Alert.alert('Eliminar plantilla', '¿Deseas eliminar esta plantilla?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const result = await deletePaymentTemplate(templateId);
          if (!result) {
            Alert.alert('Error', 'No se pudo eliminar la plantilla.');
            return;
          }
          router.replace('/payment_templates');
        },
      },
    ]);
  };

  const renderCreditorFields = () => {
    if (creditorType === 'client') {
      return (
        <SearchableSelect
          style={styles.select}
          items={clientItems}
          selectedValue={creditorClientId}
          placeholder="-- Selecciona cliente --"
          onValueChange={value => {
            const stringValue = value?.toString() ?? '';
            if (stringValue === NEW_CLIENT_VALUE) {
              beginSelection(SELECTION_KEYS.paymentTemplates.creditorClient);
              router.push('/clients/create');
              return;
            }
            setCreditorClientId(stringValue);
          }}
          onItemLongPress={item => {
            const stringValue = String(item.value ?? '');
            if (!stringValue || stringValue === NEW_CLIENT_VALUE) {
              return;
            }
            beginSelection(SELECTION_KEYS.paymentTemplates.creditorClient);
            router.push(`/clients/${stringValue}`);
          }}
        />
      );
    }
    if (creditorType === 'provider') {
      return (
        <SearchableSelect
          style={styles.select}
          items={providerItems}
          selectedValue={creditorProviderId}
          placeholder="-- Selecciona proveedor --"
          onValueChange={value => {
            const stringValue = value?.toString() ?? '';
            if (stringValue === NEW_PROVIDER_VALUE) {
              beginSelection(SELECTION_KEYS.paymentTemplates.creditorProvider);
              router.push('/providers/create');
              return;
            }
            setCreditorProviderId(stringValue);
          }}
          onItemLongPress={item => {
            const stringValue = String(item.value ?? '');
            if (!stringValue || stringValue === NEW_PROVIDER_VALUE) {
              return;
            }
            beginSelection(SELECTION_KEYS.paymentTemplates.creditorProvider);
            router.push(`/providers/${stringValue}`);
          }}
        />
      );
    }
    return (
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
        placeholder="Nombre del acreedor"
        placeholderTextColor={placeholderColor}
        value={creditorOther}
        onChangeText={setCreditorOther}
      />
    );
  };

  if (!localState.template) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: screenBackground, justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText>Cargando plantilla...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.label}>Nombre de la plantilla *</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
          placeholder="Describe la plantilla"
          placeholderTextColor={placeholderColor}
          value={name}
          onChangeText={setName}
        />

        <ThemedText style={styles.label}>Descripción</ThemedText>
        <TextInput
          style={[styles.textarea, { backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
          placeholder="Notas adicionales"
          placeholderTextColor={placeholderColor}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        <ThemedText style={styles.label}>Icono</ThemedText>
        <IconSelector
          style={styles.iconSelector}
          options={PAYMENT_TEMPLATE_ICON_OPTIONS}
          value={iconName || null}
          onChange={next => setIconName(next ?? '')}
        />

        <ThemedText style={styles.label}>Monto predeterminado</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
          placeholder="0.00"
          placeholderTextColor={placeholderColor}
          keyboardType="decimal-pad"
          value={defaultAmount}
          onChangeText={setDefaultAmount}
        />

        <ThemedText style={styles.label}>Categoría contable</ThemedText>
        <SearchableSelect
          style={styles.select}
          items={categoryItems}
          selectedValue={defaultCategoryId}
          placeholder="-- Selecciona categoría --"
          onValueChange={value => {
            const stringValue = value?.toString() ?? '';
            if (stringValue === NEW_CATEGORY_VALUE) {
              beginSelection(SELECTION_KEYS.paymentTemplates.category);
              router.push('/categories/create');
              return;
            }
            setDefaultCategoryId(stringValue);
          }}
          onItemLongPress={item => {
            const stringValue = String(item.value ?? '');
            if (!stringValue || stringValue === NEW_CATEGORY_VALUE) {
              return;
            }
            beginSelection(SELECTION_KEYS.paymentTemplates.category);
            router.push(`/categories/${stringValue}`);
          }}
        />

        <ThemedText style={styles.label}>Cuenta contable</ThemedText>
        <SearchableSelect
          style={styles.select}
          items={cashBoxItems}
          selectedValue={defaultPaidWithAccount}
          placeholder="-- Selecciona cuenta --"
          onValueChange={value => {
            const stringValue = value?.toString() ?? '';
            if (stringValue === NEW_CASH_BOX_VALUE) {
              beginSelection(SELECTION_KEYS.paymentTemplates.cashBox);
              router.push('/cash_boxes/create');
              return;
            }
            setDefaultPaidWithAccount(stringValue);
          }}
          onItemLongPress={item => {
            const stringValue = String(item.value ?? '');
            if (!stringValue || stringValue === NEW_CASH_BOX_VALUE) {
              return;
            }
            beginSelection(SELECTION_KEYS.paymentTemplates.cashBox);
            router.push(`/cash_boxes/${stringValue}`);
          }}
        />

        <ThemedText style={styles.label}>Acreedor predeterminado</ThemedText>
        <RadioGroup
          options={creditorOptions.map(option => ({ label: option.label, value: option.value }))}
          value={creditorType}
          onValueChange={value => {
            setCreditorType(value as CreditorType);
            if (value !== 'client') {
              setCreditorClientId('');
            }
            if (value !== 'provider') {
              setCreditorProviderId('');
            }
            if (value !== 'other') {
              setCreditorOther('');
            }
          }}
        />
        {renderCreditorFields()}

        <View style={styles.switchRow}>
          <ThemedText style={styles.label}>Cargar a cliente</ThemedText>
          <Switch value={chargeClient} onValueChange={setChargeClient} />
        </View>
        {chargeClient ? (
          <SearchableSelect
            style={styles.select}
            items={clientItems}
            selectedValue={chargeClientId}
            placeholder="-- Selecciona cliente --"
            onValueChange={value => {
              const stringValue = value?.toString() ?? '';
              if (stringValue === NEW_CLIENT_VALUE) {
                beginSelection(SELECTION_KEYS.paymentTemplates.chargeClient);
                router.push('/clients/create');
                return;
              }
              setChargeClientId(stringValue);
            }}
            onItemLongPress={item => {
              const stringValue = String(item.value ?? '');
              if (!stringValue || stringValue === NEW_CLIENT_VALUE) {
                return;
              }
              beginSelection(SELECTION_KEYS.paymentTemplates.chargeClient);
              router.push(`/clients/${stringValue}`);
            }}
          />
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>
            {loading ? 'Guardando...' : 'Actualizar plantilla'}
          </ThemedText>
        </TouchableOpacity>

        {canDelete ? (
          <TouchableOpacity style={[styles.deleteButton, { backgroundColor: dangerColor }]} onPress={handleDelete}>
            <ThemedText style={[styles.submitButtonText, { color: '#fff' }]}>Eliminar plantilla</ThemedText>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 100,
  },
  iconSelector: {
    marginBottom: 16,
  },
  select: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});

