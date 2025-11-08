import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { InvoicesContext, type InvoicePayload } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { JobsContext } from '@/contexts/JobsContext';
import { TariffsContext, type Tariff } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { calculateJobTotal, parseJobIdsParam } from '@/utils/jobTotals';
import {
  InvoiceItemFormValue,
  calculateInvoiceItemsTotal,
  createInvoiceItemsFromJobs,
  hasInvoiceItemData,
  prepareInvoiceConceptPayloads,
} from '@/utils/invoiceItems';

interface InvoiceFormState {
  invoiceNumber: string;
  clientId: string;
  jobIds: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  notes: string;
}

const DEFAULT_FORM_STATE: InvoiceFormState = {
  invoiceNumber: '',
  clientId: '',
  jobIds: '',
  issueDate: '',
  dueDate: '',
  currency: 'ARS',
  notes: '',
};

const parseJobIdsInput = (value: string): number[] => {
  if (!value.trim()) {
    return [];
  }
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => Number(item))
    .filter(item => Number.isFinite(item));
};

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobIds?: string | string[]; clientId?: string | string[] }>();
  const { addInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { jobs, loadJobs } = useContext(JobsContext);
  const { tariffs } = useContext(TariffsContext);

  const [formState, setFormState] = useState<InvoiceFormState>(DEFAULT_FORM_STATE);
  const [items, setItems] = useState<InvoiceItemFormValue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const lastPrefill = useRef<{ jobIds: string; clientId: string }>({
    jobIds: '',
    clientId: '',
  });
  const itemsTouchedManually = useRef(false);

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888888', dark: '#AAAAAA' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const highlightBackground = useThemeColor({ light: '#F1F5F9', dark: '#1F2937' }, 'background');
  const highlightBorder = useThemeColor({ light: '#CBD5F5', dark: '#334155' }, 'background');

  const canCreate = permissions.includes('addInvoice');

  const selectedJobIds = useMemo(() => new Set(parseJobIdsParam(params.jobIds)), [params.jobIds]);

  const tariffAmountById = useMemo(() => {
    const amountById = new Map<number, number>();
    tariffs.forEach((tariff: Tariff) => {
      amountById.set(tariff.id, tariff.amount);
    });
    return amountById;
  }, [tariffs]);

  const selectedJobs = useMemo(() => {
    if (selectedJobIds.size === 0) {
      return [];
    }
    return jobs.filter(job => selectedJobIds.has(job.id));
  }, [jobs, selectedJobIds]);

  const selectedJobsTotal = useMemo(() => {
    if (selectedJobs.length === 0) {
      return 0;
    }
    return selectedJobs.reduce((total, job) => {
      const jobTotal = calculateJobTotal(job, tariffAmountById);
      if (!Number.isFinite(jobTotal) || jobTotal <= 0) {
        return total;
      }
      return total + jobTotal;
    }, 0);
  }, [selectedJobs, tariffAmountById]);

  const formattedSelectedJobsTotal = useMemo(
    () => formatCurrency(selectedJobsTotal),
    [selectedJobsTotal],
  );

  const selectedJobsCount = selectedJobs.length;

  const itemsTotal = useMemo(() => calculateInvoiceItemsTotal(items), [items]);
  const formattedItemsTotal = useMemo(() => formatCurrency(itemsTotal), [itemsTotal]);

  const clientIdFromParams = useMemo(() => {
    const raw = params.clientId;
    const normalized = Array.isArray(raw) ? raw[0] : raw;
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.clientId]);

  const derivedClientId = useMemo(() => {
    if (clientIdFromParams !== null) {
      return clientIdFromParams;
    }

    if (selectedJobsCount === 0) {
      return null;
    }

    const uniqueClientIds = new Set(selectedJobs.map(job => job.client_id));
    if (uniqueClientIds.size === 1) {
      return selectedJobs[0]?.client_id ?? null;
    }

    return null;
  }, [clientIdFromParams, selectedJobs, selectedJobsCount]);

  const formattedJobIds = useMemo(() => {
    if (selectedJobIds.size === 0) {
      return '';
    }
    return Array.from(selectedJobIds.values())
      .map(id => id.toString())
      .join(', ');
  }, [selectedJobIds]);

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear facturas.');
      router.back();
    }
  }, [canCreate, router]);

  useEffect(() => {
    if (selectedJobIds.size > 0) {
      void loadJobs();
    }
  }, [loadJobs, selectedJobIds.size]);

  useEffect(() => {
    setFormState(current => {
      let nextState = current;
      let didUpdate = false;

      if (formattedJobIds && (current.jobIds.trim().length === 0 || current.jobIds === lastPrefill.current.jobIds)) {
        nextState = { ...nextState, jobIds: formattedJobIds };
        lastPrefill.current.jobIds = formattedJobIds;
        didUpdate = true;
      }

      if (
        derivedClientId !== null &&
        (current.clientId.trim().length === 0 || current.clientId === lastPrefill.current.clientId)
      ) {
        const clientIdString = derivedClientId.toString();
        nextState = nextState === current ? { ...nextState } : nextState;
        nextState.clientId = clientIdString;
        lastPrefill.current.clientId = clientIdString;
        didUpdate = true;
      }

      return didUpdate ? nextState : current;
    });
  }, [derivedClientId, formattedJobIds]);

  useEffect(() => {
    if (selectedJobsCount === 0) {
      if (!itemsTouchedManually.current) {
        setItems([]);
      }
      return;
    }

    if (items.length === 0 && !itemsTouchedManually.current) {
      const generated = createInvoiceItemsFromJobs(selectedJobs, tariffAmountById);
      setItems(generated);
    }
  }, [items.length, selectedJobs, selectedJobsCount, tariffAmountById]);

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
    itemsTouchedManually.current = true;
    setItems(current => {
      const next = [...current];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const handleAddItem = () => {
    itemsTouchedManually.current = true;
    setItems(current => [
      ...current,
      { conceptCode: '', description: '', quantity: '1', unitPrice: '', jobId: '' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    itemsTouchedManually.current = true;
    setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleGenerateItemsFromJobs = () => {
    if (selectedJobsCount === 0) {
      Alert.alert('Sin trabajos seleccionados', 'Seleccioná trabajos para generar conceptos.');
      return;
    }
    const generated = createInvoiceItemsFromJobs(selectedJobs, tariffAmountById);
    setItems(generated);
    itemsTouchedManually.current = false;
  };

  const handleSubmit = async () => {
    if (!canCreate) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear facturas.');
      return;
    }
    if (!isValid) {
      Alert.alert(
        'Datos incompletos',
        'Completá el número, el cliente y al menos un concepto con cantidad y precio.',
      );
      return;
    }

    const clientId = Number(formState.clientId.trim());
    if (!Number.isFinite(clientId)) {
      Alert.alert('Cliente inválido', 'Ingresá un identificador numérico de cliente.');
      return;
    }

    const concepts = prepareInvoiceConceptPayloads(items);
    if (concepts.length === 0) {
      Alert.alert(
        'Conceptos incompletos',
        'Agregá al menos un concepto con cantidad y precio para generar la factura.',
      );
      return;
    }

    setSubmitting(true);

    const payload: InvoicePayload = {
      invoice_number: formState.invoiceNumber.trim(),
      client_id: clientId,
      job_ids: parseJobIdsInput(formState.jobIds),
      issue_date: formState.issueDate.trim() || null,
      due_date: formState.dueDate.trim() || null,
      total_amount: itemsTotal || null,
      currency: formState.currency.trim() || null,
      status: 'draft',
      concepts,
    };

    if (formState.notes.trim()) {
      payload.metadata = { notes: formState.notes.trim() };
    }

    const created = await addInvoice(payload);
    setSubmitting(false);

    if (created) {
      Alert.alert('Factura creada', 'El comprobante quedó en estado borrador.');
      router.replace('/invoices');
    } else {
      Alert.alert('Error', 'No fue posible crear la factura. Revisá los datos e intentá nuevamente.');
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { backgroundColor: background }]}
    >
      {selectedJobsCount > 0 ? (
        <View
          style={[
            styles.selectionSummary,
            { borderColor: highlightBorder, backgroundColor: highlightBackground },
          ]}
        >
          <ThemedText style={styles.selectionSummaryTitle}>
            Trabajos preseleccionados: {selectedJobsCount}
          </ThemedText>
          <ThemedText style={styles.selectionSummaryBody}>
            Total estimado por trabajos: {formattedSelectedJobsTotal}
          </ThemedText>
          <ThemedText style={styles.selectionSummaryNote}>
            Los campos de trabajos, cliente y conceptos iniciales se completaron automáticamente según tu selección.
          </ThemedText>
        </View>
      ) : null}

      <ThemedText style={styles.sectionTitle}>Datos principales</ThemedText>

      <ThemedText style={styles.label}>Número de factura</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="Ej: A-0001-00001234"
        placeholderTextColor={placeholderColor}
        value={formState.invoiceNumber}
        onChangeText={handleChange('invoiceNumber')}
        autoCapitalize="characters"
      />

      <ThemedText style={styles.label}>Cliente (ID)</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="Identificador numérico"
        placeholderTextColor={placeholderColor}
        value={formState.clientId}
        onChangeText={handleChange('clientId')}
        keyboardType="numeric"
      />

      <ThemedText style={styles.label}>Trabajos vinculados</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="IDs separados por coma (ej: 10, 12, 18)"
        placeholderTextColor={placeholderColor}
        value={formState.jobIds}
        onChangeText={handleChange('jobIds')}
        autoCapitalize="none"
      />

      <ThemedText style={styles.sectionTitle}>Fechas y totales</ThemedText>

      <ThemedText style={styles.label}>Fecha de emisión (YYYY-MM-DD)</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="2024-05-10"
        placeholderTextColor={placeholderColor}
        value={formState.issueDate}
        onChangeText={handleChange('issueDate')}
        autoCapitalize="none"
      />

      <ThemedText style={styles.label}>Fecha de vencimiento (opcional)</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="2024-06-10"
        placeholderTextColor={placeholderColor}
        value={formState.dueDate}
        onChangeText={handleChange('dueDate')}
        autoCapitalize="none"
      />

      <ThemedText style={styles.label}>Moneda</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="ARS"
        placeholderTextColor={placeholderColor}
        value={formState.currency}
        onChangeText={handleChange('currency')}
        autoCapitalize="characters"
        maxLength={5}
      />

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Conceptos facturados</ThemedText>
        <View style={styles.sectionActions}>
          <TouchableOpacity style={[styles.sectionActionButton, { backgroundColor: buttonColor }]} onPress={handleAddItem}>
            <ThemedText style={[styles.sectionActionText, { color: buttonTextColor }]}>Agregar concepto</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionActionButtonSecondary, { borderColor: buttonColor }]}
            onPress={handleGenerateItemsFromJobs}
          >
            <ThemedText style={[styles.sectionActionSecondaryText, { color: buttonColor }]}>Desde trabajos</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={[styles.emptyItems, { borderColor }]}
        >
          <ThemedText style={styles.emptyItemsText}>
            Añadí conceptos manualmente o generálos desde los trabajos seleccionados.
          </ThemedText>
        </View>
      ) : null}

      {items.map((item, index) => (
        <View key={`invoice-item-${index}`} style={[styles.itemContainer, { borderColor }]}
        >
          <View style={styles.itemHeader}>
            <ThemedText style={styles.itemTitle}>Concepto #{index + 1}</ThemedText>
            <TouchableOpacity onPress={() => handleRemoveItem(index)}>
              <ThemedText style={styles.removeItemText}>Quitar</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.label}>Código (opcional)</ThemedText>
          <TextInput
            style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
            placeholder="Ej: SERV-001"
            placeholderTextColor={placeholderColor}
            value={item.conceptCode}
            onChangeText={handleItemChange(index, 'conceptCode')}
            autoCapitalize="characters"
          />

          <ThemedText style={styles.label}>Descripción</ThemedText>
          <TextInput
            style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
            placeholder="Detalle del servicio"
            placeholderTextColor={placeholderColor}
            value={item.description}
            onChangeText={handleItemChange(index, 'description')}
          />

          <View style={styles.itemRow}>
            <View style={styles.itemColumn}>
              <ThemedText style={styles.label}>Cantidad</ThemedText>
              <TextInput
                style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
                placeholder="Ej: 1"
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
                placeholder="Ej: 1500"
                placeholderTextColor={placeholderColor}
                value={item.unitPrice}
                onChangeText={handleItemChange(index, 'unitPrice')}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <ThemedText style={styles.label}>Trabajo vinculado (ID opcional)</ThemedText>
          <TextInput
            style={[styles.input, styles.itemInput, { borderColor, backgroundColor: inputBackground, color: textColor }]}
            placeholder="Ej: 42"
            placeholderTextColor={placeholderColor}
            value={item.jobId}
            onChangeText={handleItemChange(index, 'jobId')}
            keyboardType="numeric"
          />
        </View>
      ))}

      <View style={[styles.itemsTotalContainer, { borderColor }]}
      >
        <ThemedText style={styles.itemsTotalLabel}>Total calculado por conceptos</ThemedText>
        <ThemedText style={styles.itemsTotalValue}>{formattedItemsTotal}</ThemedText>
      </View>

      <ThemedText style={styles.sectionTitle}>Notas internas</ThemedText>
      <TextInput
        style={[styles.textarea, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="Agregar comentarios o instrucciones para el equipo."
        placeholderTextColor={placeholderColor}
        value={formState.notes}
        onChangeText={handleChange('notes')}
        multiline
        numberOfLines={5}
      />

      {canCreate ? (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: buttonColor }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: buttonTextColor }]}>Crear factura</ThemedText>
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
  selectionSummary: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  selectionSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionSummaryBody: {
    fontSize: 14,
  },
  selectionSummaryNote: {
    fontSize: 13,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    marginTop: 8,
    gap: 12,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sectionActionText: {
    fontWeight: '600',
  },
  sectionActionButtonSecondary: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionActionSecondaryText: {
    fontWeight: '600',
  },
  emptyItems: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  emptyItemsText: {
    fontSize: 14,
    color: '#6B7280',
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
  itemsTotalContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemsTotalValue: {
    fontSize: 18,
    fontWeight: '700',
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
});
