import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InvoicesContext, type Invoice, type InvoicePayload } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { JobsContext } from '@/contexts/JobsContext';
import { TariffsContext, type Tariff } from '@/contexts/TariffsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { calculateJobTotal, parseJobIdsParam } from '@/utils/jobTotals';
import {
  InvoiceItemFormValue,
  calculateInvoiceItemsTotal,
  createInvoiceItemsFromJobs,
  mapInvoiceConceptToFormValue,
  mergeInvoiceItemsWithJobs,
  prepareInvoiceConceptPayloads,
} from '@/utils/invoiceItems';

interface InvoiceFormState {
  invoiceNumber: string;
  clientId: string;
  jobIds: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: string;
  notes: string;
}

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

const getInitialState = (invoice: Invoice | undefined): InvoiceFormState => {
  if (!invoice) {
    return {
      invoiceNumber: '',
      clientId: '',
      jobIds: '',
      issueDate: '',
      dueDate: '',
      currency: 'ARS',
      status: 'draft',
      notes: '',
    };
  }

  const notesFromMetadata = (() => {
    if (invoice.metadata && typeof invoice.metadata === 'object') {
      const metadata = invoice.metadata as Record<string, unknown>;
      const direct = metadata.notes ?? metadata.note ?? metadata.comment ?? metadata.observations;
      if (typeof direct === 'string') {
        return direct;
      }
    }
    return '';
  })();

  return {
    invoiceNumber: invoice.invoice_number ?? '',
    clientId: invoice.client_id !== null ? invoice.client_id.toString() : '',
    jobIds: invoice.job_ids.join(', '),
    issueDate: invoice.issue_date ?? '',
    dueDate: invoice.due_date ?? '',
    currency: invoice.currency ?? 'ARS',
    status: invoice.status ?? 'draft',
    notes: notesFromMetadata,
  };
};

export default function EditInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; jobIds?: string | string[] }>();
  const invoiceId = useMemo(() => {
    if (!params.id) {
      return null;
    }
    const normalized = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.id]);

  const { invoices, loadInvoices, updateInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { jobs, loadJobs } = useContext(JobsContext);
  const { tariffs } = useContext(TariffsContext);

  const canUpdate = permissions.includes('updateInvoice');

  const currentInvoice = useMemo(
    () => invoices.find(invoice => invoice.id === invoiceId) ?? undefined,
    [invoiceId, invoices],
  );

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

  const mergedJobIdsString = useMemo(() => {
    const merged = new Set<number>();
    if (currentInvoice) {
      currentInvoice.job_ids.forEach(id => merged.add(id));
    }
    selectedJobIds.forEach(id => merged.add(id));
    if (merged.size === 0) {
      return '';
    }
    return Array.from(merged.values())
      .sort((a, b) => a - b)
      .map(id => id.toString())
      .join(', ');
  }, [currentInvoice, selectedJobIds]);

  const baseInvoiceJobIdsString = useMemo(() => {
    if (!currentInvoice) {
      return '';
    }
    return currentInvoice.job_ids.join(', ');
  }, [currentInvoice]);

  const [formState, setFormState] = useState<InvoiceFormState>(getInitialState(currentInvoice));
  const [items, setItems] = useState<InvoiceItemFormValue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!currentInvoice);
  const lastPrefillJobIds = useRef<string>('');
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

  const itemsTotal = useMemo(() => calculateInvoiceItemsTotal(items), [items]);
  const formattedItemsTotal = useMemo(() => formatCurrency(itemsTotal), [itemsTotal]);

  useEffect(() => {
    if (!canUpdate) {
      Alert.alert('Acceso denegado', 'No tienes permiso para editar facturas.');
      router.back();
    }
  }, [canUpdate, router]);

  useEffect(() => {
    if (selectedJobIds.size > 0) {
      void loadJobs();
    }
  }, [loadJobs, selectedJobIds.size]);

  useEffect(() => {
    if (!invoiceId) {
      Alert.alert('Factura no encontrada', 'No se pudo determinar qué factura editar.');
      router.back();
      return;
    }

    if (!currentInvoice) {
      setIsLoading(true);
      void loadInvoices().finally(() => {
        setIsLoading(false);
      });
    }
  }, [currentInvoice, invoiceId, loadInvoices, router]);

  useEffect(() => {
    if (currentInvoice) {
      setFormState(getInitialState(currentInvoice));
      const mappedItems = (currentInvoice.concepts ?? []).map(mapInvoiceConceptToFormValue);
      setItems(mappedItems);
      itemsTouchedManually.current = false;
      setIsLoading(false);
    }
  }, [currentInvoice]);

  useEffect(() => {
    lastPrefillJobIds.current = baseInvoiceJobIdsString;
  }, [baseInvoiceJobIdsString]);

  useEffect(() => {
    if (!mergedJobIdsString) {
      return;
    }

    setFormState(current => {
      if (current.jobIds.trim().length === 0 || current.jobIds === lastPrefillJobIds.current) {
        lastPrefillJobIds.current = mergedJobIdsString;
        return { ...current, jobIds: mergedJobIdsString };
      }
      return current;
    });
  }, [mergedJobIdsString]);

  useEffect(() => {
    if (selectedJobs.length === 0) {
      return;
    }
    setItems(current => mergeInvoiceItemsWithJobs(current, selectedJobs, tariffAmountById));
  }, [selectedJobs, tariffAmountById]);

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
    if (!currentInvoice && selectedJobs.length === 0) {
      Alert.alert('Sin trabajos seleccionados', 'No hay trabajos asociados para importar conceptos.');
      return;
    }
    const jobsToProcess = selectedJobs.length > 0 ? selectedJobs : jobs.filter(job => currentInvoice?.job_ids.includes(job.id));
    if (jobsToProcess.length === 0) {
      Alert.alert('Sin trabajos asociados', 'La factura no tiene trabajos vinculados para generar conceptos.');
      return;
    }
    const generated = createInvoiceItemsFromJobs(jobsToProcess, tariffAmountById);
    setItems(current => {
      if (!itemsTouchedManually.current) {
        return generated;
      }
      return mergeInvoiceItemsWithJobs(current, jobsToProcess, tariffAmountById);
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!canUpdate) {
      Alert.alert('Acceso denegado', 'No tienes permiso para editar facturas.');
      return;
    }
    if (!invoiceId) {
      Alert.alert('Error', 'No se reconoce el comprobante a actualizar.');
      return;
    }

    if (!formState.invoiceNumber.trim()) {
      Alert.alert('Datos incompletos', 'Completá el número de la factura.');
      return;
    }

    const clientId = Number(formState.clientId.trim());
    if (!Number.isFinite(clientId)) {
      Alert.alert('Cliente inválido', 'Ingresá un identificador de cliente válido.');
      return;
    }

    const concepts = prepareInvoiceConceptPayloads(items);
    if (concepts.length === 0) {
      Alert.alert('Conceptos incompletos', 'Agregá al menos un concepto válido antes de guardar.');
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
      status: formState.status.trim() || 'draft',
      concepts,
    };

    if (formState.notes.trim()) {
      payload.metadata = { notes: formState.notes.trim() };
    }

    const updated = await updateInvoice(invoiceId, payload);
    setSubmitting(false);

    if (updated) {
      Alert.alert('Factura actualizada', 'Los cambios se guardaron correctamente.');
      router.back();
    } else {
      Alert.alert('Error', 'No fue posible actualizar la factura. Intentá nuevamente.');
    }
  }, [canUpdate, formState, invoiceId, items, itemsTotal, router, updateInvoice]);

  if (!invoiceId) {
    return null;
  }

  if (isLoading) {
    return (
      <ThemedView style={[styles.loadingContainer, { backgroundColor: background }]}
      >
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!currentInvoice) {
    return (
      <ThemedView style={[styles.loadingContainer, { backgroundColor: background }]}
      >
        <ThemedText>No encontramos la factura solicitada.</ThemedText>
      </ThemedView>
    );
  }

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
            Se agregaron los trabajos seleccionados a la lista vinculada. Verificá los conceptos antes de guardar.
          </ThemedText>
        </View>
      ) : null}

      <ThemedText style={styles.sectionTitle}>Datos principales</ThemedText>

      <ThemedText style={styles.label}>Número de factura</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="Número fiscal"
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

      <ThemedText style={styles.label}>Estado</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="draft | issued | void"
        placeholderTextColor={placeholderColor}
        value={formState.status}
        onChangeText={handleChange('status')}
        autoCapitalize="none"
      />

      <ThemedText style={styles.label}>Trabajos vinculados</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="IDs separados por coma"
        placeholderTextColor={placeholderColor}
        value={formState.jobIds}
        onChangeText={handleChange('jobIds')}
        autoCapitalize="none"
      />

      <ThemedText style={styles.sectionTitle}>Fechas y totales</ThemedText>

      <ThemedText style={styles.label}>Fecha de emisión</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={placeholderColor}
        value={formState.issueDate}
        onChangeText={handleChange('issueDate')}
        autoCapitalize="none"
      />

      <ThemedText style={styles.label}>Fecha de vencimiento</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="YYYY-MM-DD"
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
            Agregá los conceptos facturados para este comprobante. Podés importarlos desde los trabajos vinculados.
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
        placeholder="Comentarios visibles solo para el equipo interno"
        placeholderTextColor={placeholderColor}
        value={formState.notes}
        onChangeText={handleChange('notes')}
        multiline
        numberOfLines={5}
      />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 160,
    gap: 16,
  },
  selectionSummary: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  selectionSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  selectionSummaryBody: {
    fontSize: 14,
  },
  selectionSummaryNote: {
    fontSize: 12,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    marginTop: 16,
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
    borderRadius: 10,
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
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
