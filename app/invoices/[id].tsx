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

interface InvoiceFormState {
  invoiceNumber: string;
  clientId: string;
  jobIds: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  currency: string;
  status: string;
  notes: string;
}

const parseAmountInput = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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

const getInitialState = (invoice: Invoice | undefined): InvoiceFormState => {
  if (!invoice) {
    return {
      invoiceNumber: '',
      clientId: '',
      jobIds: '',
      issueDate: '',
      dueDate: '',
      totalAmount: '',
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
    totalAmount:
      typeof invoice.total_amount === 'number' && Number.isFinite(invoice.total_amount)
        ? invoice.total_amount.toString()
        : '',
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
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!currentInvoice);
  const lastPrefillJobIds = useRef<string>('');

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888888', dark: '#AAAAAA' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const highlightBackground = useThemeColor({ light: '#F1F5F9', dark: '#1F2937' }, 'background');
  const highlightBorder = useThemeColor({ light: '#CBD5F5', dark: '#334155' }, 'background');

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

  const handleChange = (key: keyof InvoiceFormState) => (value: string) => {
    setFormState(current => ({ ...current, [key]: value }));
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

    setSubmitting(true);

    const payload: InvoicePayload = {
      invoice_number: formState.invoiceNumber.trim(),
      client_id: clientId,
      job_ids: parseJobIdsInput(formState.jobIds),
      issue_date: formState.issueDate.trim() || null,
      due_date: formState.dueDate.trim() || null,
      total_amount: parseAmountInput(formState.totalAmount),
      currency: formState.currency.trim() || null,
      status: formState.status.trim() || 'draft',
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
  }, [formState, invoiceId, router, updateInvoice]);

  if (!invoiceId) {
    return null;
  }

  if (isLoading) {
    return (
      <ThemedView style={[styles.loadingContainer, { backgroundColor: background }]}> 
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!currentInvoice) {
    return (
      <ThemedView style={[styles.loadingContainer, { backgroundColor: background }]}> 
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
            Se agregó la selección a la lista de trabajos vinculados. Revisá y confirma antes de guardar.
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

      <ThemedText style={styles.label}>Importe total</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
        placeholder="Ej: 15400,50"
        placeholderTextColor={placeholderColor}
        value={formState.totalAmount}
        onChangeText={handleChange('totalAmount')}
        keyboardType="decimal-pad"
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
    paddingBottom: 120,
  },
  selectionSummary: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  selectionSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectionSummaryBody: {
    fontSize: 14,
    marginBottom: 8,
  },
  selectionSummaryNote: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
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
