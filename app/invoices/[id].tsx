import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InvoicesContext, type Invoice, type InvoicePayload } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import {
  InvoiceItemFormValue,
  calculateInvoiceItemsSubtotal,
  calculateInvoiceItemsTax,
  calculateInvoiceItemsTotal,
  invoiceItemsProvideSubtotalData,
  invoiceItemsProvideTaxData,
  hasInvoiceItemData,
  mapInvoiceItemToFormValue,
  prepareInvoiceItemPayloads,
} from '@/utils/invoiceItems';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';

interface InvoiceFormState {
  id: string;
  invoiceDate: string;
  dueDate: string;
  clientId: string;
  invoiceNumber: string;
  currencyCode: string;
  companyId: string;
  status: string;
  notes: string;
}

const createEmptyItem = (): InvoiceItemFormValue => ({
  description: '',
  quantity: '1',
  unitPrice: '',
  productId: '',
  discountAmount: '0',
  taxAmount: '0',
  totalAmount: '',
  orderIndex: '',
});

const extractNotes = (invoice: Invoice | undefined): string => {
  if (!invoice?.metadata || typeof invoice.metadata !== 'object') {
    return '';
  }
  const metadata = invoice.metadata as Record<string, unknown>;
  const value = metadata.notes ?? metadata.note ?? metadata.comment ?? metadata.observations;
  return typeof value === 'string' ? value : '';
};

const buildInitialState = (invoice: Invoice | undefined): InvoiceFormState => ({
  id: invoice ? invoice.id.toString() : '',
  invoiceDate: invoice?.invoice_date ?? invoice?.issue_date ?? '',
  dueDate: invoice?.due_date ?? '',
  clientId: invoice?.client_id !== null && typeof invoice?.client_id !== 'undefined'
    ? invoice.client_id.toString()
    : '',
  invoiceNumber: invoice?.invoice_number ?? '',
  currencyCode: invoice?.currency ?? 'ARS',
  companyId: typeof invoice?.company_id === 'number' && Number.isFinite(invoice.company_id)
    ? invoice.company_id.toString()
    : '',
  status: invoice?.status ?? 'draft',
  notes: extractNotes(invoice),
});

const NEW_CLIENT_VALUE = '__new_client__';

export default function EditInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const invoiceId = useMemo(() => {
    const rawId = params.id;
    const normalized = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.id]);

  const { invoices, loadInvoices, updateInvoice, deleteInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { beginSelection, consumeSelection, pendingSelections, cancelSelection } = usePendingSelection();

  const [formState, setFormState] = useState<InvoiceFormState>(buildInitialState(undefined));
  const [items, setItems] = useState<InvoiceItemFormValue[]>([createEmptyItem()]);
  const [expandedMetadata, setExpandedMetadata] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888888', dark: '#AAAAAA' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const dangerColor = useThemeColor({ light: '#ff4d4f', dark: '#ff7072' }, 'button');
  const secondaryText = useThemeColor({ light: '#6B7280', dark: '#94A3B8' }, 'text');

  const canUpdate = permissions.includes('updateInvoice');
  const canDelete = permissions.includes('deleteInvoice');

  const currentInvoice = useMemo(
    () => invoices.find(invoice => invoice.id === invoiceId),
    [invoiceId, invoices],
  );

  const hasSubtotalData = useMemo(() => invoiceItemsProvideSubtotalData(items), [items]);
  const hasTaxData = useMemo(() => invoiceItemsProvideTaxData(items), [items]);

  const subtotal = useMemo(() => {
    const derivedSubtotal = calculateInvoiceItemsSubtotal(items);
    if (hasSubtotalData) {
      return derivedSubtotal;
    }

    const existingSubtotal = currentInvoice?.subtotal_amount;
    return typeof existingSubtotal === 'number' && Number.isFinite(existingSubtotal)
      ? existingSubtotal
      : derivedSubtotal;
  }, [currentInvoice, hasSubtotalData, items]);

  const taxes = useMemo(() => {
    const derivedTaxes = calculateInvoiceItemsTax(items);
    if (hasTaxData) {
      return derivedTaxes;
    }

    const existingTaxes = currentInvoice?.tax_amount;
    return typeof existingTaxes === 'number' && Number.isFinite(existingTaxes)
      ? existingTaxes
      : derivedTaxes;
  }, [currentInvoice, hasTaxData, items]);
  const total = useMemo(() => calculateInvoiceItemsTotal(items), [items]);

  const formattedSubtotal = useMemo(() => formatCurrency(subtotal), [subtotal]);
  const formattedTaxes = useMemo(() => formatCurrency(taxes), [taxes]);
  const formattedTotal = useMemo(() => formatCurrency(total), [total]);

  const clientItems = useMemo(
    () => [
      { label: '-- Selecciona un cliente --', value: '' },
      { label: '➕ Nuevo cliente', value: NEW_CLIENT_VALUE },
      ...clients.map(client => ({
        label: client.business_name,
        value: client.id.toString(),
      })),
    ],
    [clients],
  );

  useEffect(() => {
    if (!canUpdate && !canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para editar o eliminar facturas.');
      router.back();
    }
  }, [canDelete, canUpdate, router]);

  useEffect(
    () => () => {
      cancelSelection();
    },
    [cancelSelection],
  );

  useEffect(() => {
    if (!invoiceId) {
      Alert.alert('Factura no encontrada', 'No se pudo determinar qué factura editar.');
      router.replace('/invoices');
      return;
    }

    if (currentInvoice) {
      setFormState(buildInitialState(currentInvoice));
      const mappedItems = (currentInvoice.items ?? []).map(mapInvoiceItemToFormValue);
      setItems(mappedItems.length > 0 ? mappedItems : [createEmptyItem()]);
      setExpandedItems({});
      setExpandedNotes(extractNotes(currentInvoice).trim().length > 0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void loadInvoices().then(() => {
      setIsLoading(false);
    });
  }, [currentInvoice, invoiceId, loadInvoices, router]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.invoices.client)) {
      return;
    }
    const pendingClientId = consumeSelection<string>(SELECTION_KEYS.invoices.client);
    if (pendingClientId) {
      setFormState(current => ({ ...current, clientId: pendingClientId.toString() }));
    }
  }, [pendingSelections, consumeSelection]);

  useEffect(() => {
    if (!formState.clientId) {
      return;
    }
    const exists = clients.some(client => client.id.toString() === formState.clientId);
    if (!exists) {
      setFormState(current => ({ ...current, clientId: '' }));
    }
  }, [clients, formState.clientId]);

  const isValid = useMemo(() => {
    if (!formState.invoiceNumber.trim()) {
      return false;
    }
    if (!formState.clientId.trim()) {
      return false;
    }
    if (!items.some(item => hasInvoiceItemData(item))) {
      return false;
    }
    return true;
  }, [formState.clientId, formState.invoiceNumber, items]);

  const handleChange = (key: keyof InvoiceFormState) => (value: string) => {
    setFormState(current => ({ ...current, [key]: value }));
  };

  const handleItemChange = (index: number, key: keyof InvoiceItemFormValue) => (value: string) => {
    setItems(current => {
      const next = [...current];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const handleAddItem = () => {
    setItems(current => [...current, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
    setExpandedItems(current => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const handleToggleItemDetails = (index: number) => {
    setExpandedItems(current => ({ ...current, [index]: !current[index] }));
  };

  const handleSubmit = async () => {
    if (!canUpdate) {
      Alert.alert('Acceso denegado', 'No tienes permiso para editar facturas.');
      return;
    }
    if (!invoiceId) {
      Alert.alert('Factura no encontrada', 'No se pudo determinar qué factura actualizar.');
      return;
    }
    if (!isValid) {
      Alert.alert('Datos incompletos', 'Completá el número de factura, el cliente y al menos un ítem válido.');
      return;
    }

    const clientId = Number(formState.clientId.trim());
    if (!Number.isFinite(clientId)) {
      Alert.alert('Cliente inválido', 'Seleccioná un cliente válido.');
      return;
    }

    const payloadItems = prepareInvoiceItemPayloads(items);
    if (payloadItems.length === 0) {
      Alert.alert('Ítems incompletos', 'Agregá al menos un ítem válido antes de guardar.');
      return;
    }

    const payload: InvoicePayload = {
      invoice_number: formState.invoiceNumber.trim(),
      client_id: clientId,
      invoice_date: formState.invoiceDate.trim() || null,
      due_date: formState.dueDate.trim() || null,
      currency_code: formState.currencyCode.trim() || null,
      status: formState.status.trim() || 'draft',
      items: payloadItems,
    };

    payload.total_amount = Number.isFinite(total) ? total : null;

    const shouldIncludeSubtotal =
      hasSubtotalData ||
      (typeof currentInvoice?.subtotal_amount === 'number' && Number.isFinite(currentInvoice.subtotal_amount));
    if (shouldIncludeSubtotal) {
      const normalizedSubtotal = Number.isFinite(subtotal)
        ? subtotal
        : currentInvoice?.subtotal_amount ?? null;
      payload.subtotal_amount = normalizedSubtotal;
    }

    const shouldIncludeTax =
      hasTaxData ||
      (typeof currentInvoice?.tax_amount === 'number' && Number.isFinite(currentInvoice.tax_amount));
    if (shouldIncludeTax) {
      const normalizedTax = Number.isFinite(taxes) ? taxes : currentInvoice?.tax_amount ?? null;
      payload.tax_amount = normalizedTax;
    }

    if (formState.companyId.trim()) {
      const parsedCompanyId = Number(formState.companyId.trim());
      if (Number.isFinite(parsedCompanyId)) {
        payload.company_id = parsedCompanyId;
      }
    }

    if (formState.notes.trim()) {
      payload.metadata = { notes: formState.notes.trim() };
    }

    setSubmitting(true);
    const success = await updateInvoice(invoiceId, payload);
    setSubmitting(false);

    if (success) {
      Alert.alert('Factura actualizada', 'Los cambios se guardaron correctamente.');
      router.replace('/invoices');
      return;
    }

    Alert.alert('Error', 'No fue posible actualizar la factura. Intenta nuevamente.');
  };

  const requestDelete = () => {
    if (!canDelete) {
      Alert.alert('Acceso denegado', 'No tienes permiso para eliminar facturas.');
      return;
    }
    if (!invoiceId) {
      Alert.alert('Factura no encontrada', 'No se pudo determinar qué factura eliminar.');
      return;
    }

    Alert.alert(
      'Eliminar factura',
      '¿Confirmás que querés eliminar este comprobante? La operación no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const success = await deleteInvoice(invoiceId);
            setDeleting(false);
            if (success) {
              Alert.alert('Factura eliminada', 'El comprobante se eliminó correctamente.');
              router.replace('/invoices');
            } else {
              Alert.alert('Error', 'No fue posible eliminar la factura.');
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.loaderContainer, { backgroundColor: background }]}> 
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: background }} contentContainerStyle={styles.container}>
      <ThemedText style={styles.sectionTitle}>Factura #{formState.id || invoiceId}</ThemedText>

      <ThemedText style={styles.label}>Fecha de emisión</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="AAAA-MM-DD"
        placeholderTextColor={placeholderColor}
        value={formState.invoiceDate}
        onChangeText={handleChange('invoiceDate')}
      />

      <ThemedText style={styles.label}>Fecha de vencimiento</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="AAAA-MM-DD"
        placeholderTextColor={placeholderColor}
        value={formState.dueDate}
        onChangeText={handleChange('dueDate')}
      />

      <ThemedText style={styles.label}>Cliente</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={clientItems}
        selectedValue={formState.clientId}
        onValueChange={value => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CLIENT_VALUE) {
            setFormState(current => ({ ...current, clientId: '' }));
            beginSelection(SELECTION_KEYS.invoices.client);
            router.push('/clients/create');
            return;
          }
          setFormState(current => ({ ...current, clientId: stringValue }));
        }}
        placeholder="-- Selecciona un cliente --"
        onItemLongPress={item => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CLIENT_VALUE) {
            return;
          }
          beginSelection(SELECTION_KEYS.invoices.client);
          router.push(`/clients/${value}`);
        }}
      />

      <TouchableOpacity
        style={[styles.collapseTrigger, { borderColor }]}
        onPress={() => setExpandedMetadata(value => !value)}
      >
        <ThemedText style={styles.collapseTriggerText}>
          {expandedMetadata ? 'Ocultar detalles adicionales' : 'Mostrar detalles adicionales'}
        </ThemedText>
      </TouchableOpacity>

      {expandedMetadata ? (
        <View style={[styles.metadataContainer, { borderColor }]}>
          <ThemedText style={styles.label}>Número de factura</ThemedText>
          <TextInput
            style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
            placeholder="Número interno"
            placeholderTextColor={placeholderColor}
            value={formState.invoiceNumber}
            onChangeText={handleChange('invoiceNumber')}
            autoCapitalize="characters"
          />

          <ThemedText style={styles.label}>Moneda</ThemedText>
          <TextInput
            style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
            placeholder="ARS"
            placeholderTextColor={placeholderColor}
            value={formState.currencyCode}
            onChangeText={handleChange('currencyCode')}
            autoCapitalize="characters"
            maxLength={5}
          />

          <ThemedText style={styles.label}>Empresa</ThemedText>
          <TextInput
            style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
            placeholder="ID de empresa"
            placeholderTextColor={placeholderColor}
            value={formState.companyId}
            onChangeText={handleChange('companyId')}
            keyboardType="numeric"
          />

          <ThemedText style={styles.label}>Estado</ThemedText>
          <TextInput
            style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
            placeholder="draft"
            placeholderTextColor={placeholderColor}
            value={formState.status}
            onChangeText={handleChange('status')}
            autoCapitalize="none"
          />
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionSubtitle}>Ítems de la factura</ThemedText>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: buttonColor }]} onPress={handleAddItem}>
          <ThemedText style={[styles.addButtonText, { color: buttonTextColor }]}>Agregar ítem</ThemedText>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={[styles.emptyItems, { borderColor }]}>
          <ThemedText style={[styles.emptyItemsText, { color: secondaryText }]}>Agregá los ítems a facturar.</ThemedText>
        </View>
      ) : null}

      {items.map((item, index) => {
        const isExpanded = expandedItems[index] ?? false;
        return (
          <View key={`invoice-item-${index}`} style={[styles.itemContainer, { borderColor }]}>
            <View style={styles.itemHeader}>
              <ThemedText style={styles.itemTitle}>Ítem #{index + 1}</ThemedText>
              <View style={styles.itemActions}>
                <TouchableOpacity onPress={() => handleToggleItemDetails(index)}>
                  <ThemedText style={styles.itemActionText}>
                    {isExpanded ? 'Ocultar campos' : 'Campos avanzados'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                  <ThemedText style={styles.removeItemText}>Quitar</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <ThemedText style={styles.label}>Descripción</ThemedText>
            <TextInput
              style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
              placeholder="Detalle del producto o servicio"
              placeholderTextColor={placeholderColor}
              value={item.description}
              onChangeText={handleItemChange(index, 'description')}
            />

            <View style={styles.itemRow}>
              <View style={styles.itemColumn}>
                <ThemedText style={styles.label}>Cantidad</ThemedText>
                <TextInput
                  style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                  placeholder="1"
                  placeholderTextColor={placeholderColor}
                  value={item.quantity}
                  onChangeText={handleItemChange(index, 'quantity')}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.itemColumn}>
                <ThemedText style={styles.label}>Precio unitario</ThemedText>
                <TextInput
                  style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={placeholderColor}
                  value={item.unitPrice}
                  onChangeText={handleItemChange(index, 'unitPrice')}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {isExpanded ? (
              <View style={styles.advancedItemContainer}>
                <ThemedText style={styles.advancedLabel}>ID ítem (interno)</ThemedText>
                <TextInput
                  style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                  placeholder="Autogenerado"
                  placeholderTextColor={placeholderColor}
                  value={item.id ? item.id.toString() : ''}
                  editable={false}
                />

                <ThemedText style={styles.advancedLabel}>Factura asociada</ThemedText>
                <TextInput
                  style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                  placeholder="ID de factura"
                  placeholderTextColor={placeholderColor}
                  value={item.invoiceId ? item.invoiceId.toString() : ''}
                  editable={false}
                />

                <ThemedText style={styles.advancedLabel}>Producto / Servicio</ThemedText>
                <TextInput
                  style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                  placeholder="ID del catálogo"
                  placeholderTextColor={placeholderColor}
                  value={item.productId}
                  onChangeText={handleItemChange(index, 'productId')}
                  keyboardType="numeric"
                />

                <View style={styles.itemRow}>
                  <View style={styles.itemColumn}>
                    <ThemedText style={styles.advancedLabel}>Descuento (%)</ThemedText>
                    <TextInput
                      style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      value={item.discountAmount}
                      onChangeText={handleItemChange(index, 'discountAmount')}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.itemColumn}>
                    <ThemedText style={styles.advancedLabel}>Impuesto (%)</ThemedText>
                    <TextInput
                      style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      value={item.taxAmount}
                      onChangeText={handleItemChange(index, 'taxAmount')}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View style={styles.itemRow}>
                  <View style={styles.itemColumn}>
                    <ThemedText style={styles.advancedLabel}>Total ítem</ThemedText>
                    <TextInput
                      style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                      placeholder="Calculado automáticamente"
                      placeholderTextColor={placeholderColor}
                      value={item.totalAmount}
                      onChangeText={handleItemChange(index, 'totalAmount')}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.itemColumn}>
                    <ThemedText style={styles.advancedLabel}>Orden</ThemedText>
                    <TextInput
                      style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                      placeholder={`${index + 1}`}
                      placeholderTextColor={placeholderColor}
                      value={item.orderIndex}
                      onChangeText={handleItemChange(index, 'orderIndex')}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={[styles.costSummary, { borderColor }]}>
        <ThemedText style={styles.sectionSubtitle}>Costo</ThemedText>
        <View style={styles.costRow}>
          <ThemedText style={styles.costLabel}>Subtotal</ThemedText>
          <ThemedText style={styles.costValue}>{formattedSubtotal}</ThemedText>
        </View>
        <View style={styles.costRow}>
          <ThemedText style={styles.costLabel}>Impuestos</ThemedText>
          <ThemedText style={styles.costValue}>{formattedTaxes}</ThemedText>
        </View>
        <View style={styles.costRow}>
          <ThemedText style={styles.costLabel}>Total</ThemedText>
          <ThemedText style={styles.costValue}>{formattedTotal}</ThemedText>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.collapseTrigger, { borderColor }]}
        onPress={() => setExpandedNotes(value => !value)}
      >
        <ThemedText style={styles.collapseTriggerText}>
          {expandedNotes ? 'Ocultar notas' : 'Agregar notas internas'}
        </ThemedText>
      </TouchableOpacity>

      {expandedNotes ? (
        <TextInput
          style={[styles.textarea, { borderColor, backgroundColor: inputBackground, color: textColor }]}
          placeholder="Agregar comentarios internos"
          placeholderTextColor={placeholderColor}
          value={formState.notes}
          onChangeText={handleChange('notes')}
          multiline
          numberOfLines={4}
        />
      ) : null}

      {canUpdate ? (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Guardar cambios</ThemedText>
          )}
        </TouchableOpacity>
      ) : null}

      {canDelete ? (
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: dangerColor }]}
          onPress={requestDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: '#FFFFFF' }]}>Eliminar factura</ThemedText>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  advancedLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  select: {
    marginBottom: 12,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  collapseTrigger: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  collapseTriggerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metadataContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    fontWeight: '600',
  },
  emptyItems: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  emptyItemsText: {
    fontSize: 14,
  },
  itemContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 12,
  },
  itemActionText: {
    fontWeight: '600',
  },
  removeItemText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  itemInput: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
  },
  itemColumn: {
    flex: 1,
  },
  advancedItemContainer: {
    gap: 12,
  },
  costSummary: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  costLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  costValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});
