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

interface InvoiceFormState {
  invoiceNumber: string;
  clientId: string;
  jobIds: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  currency: string;
  notes: string;
}

const DEFAULT_FORM_STATE: InvoiceFormState = {
  invoiceNumber: '',
  clientId: '',
  jobIds: '',
  issueDate: '',
  dueDate: '',
  totalAmount: '',
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

const parseAmountInput = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobIds?: string | string[]; clientId?: string | string[] }>();
  const { addInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { jobs, loadJobs } = useContext(JobsContext);
  const { tariffs } = useContext(TariffsContext);

  const [formState, setFormState] = useState<InvoiceFormState>(DEFAULT_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const lastPrefill = useRef<{ jobIds: string; clientId: string; totalAmount: string }>({
    jobIds: '',
    clientId: '',
    totalAmount: '',
  });

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

      if (
        selectedJobsTotal > 0 &&
        (current.totalAmount.trim().length === 0 || current.totalAmount === lastPrefill.current.totalAmount)
      ) {
        const totalString = selectedJobsTotal.toFixed(2);
        nextState = nextState === current ? { ...nextState } : nextState;
        nextState.totalAmount = totalString;
        lastPrefill.current.totalAmount = totalString;
        didUpdate = true;
      }

      return didUpdate ? nextState : current;
    });
  }, [derivedClientId, formattedJobIds, selectedJobsTotal]);

  const isValid = useMemo(() => {
    if (!formState.invoiceNumber.trim()) {
      return false;
    }
    if (!formState.clientId.trim()) {
      return false;
    }
    return true;
  }, [formState.clientId, formState.invoiceNumber]);

  const handleChange = (key: keyof InvoiceFormState) => (value: string) => {
    setFormState(current => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('Datos incompletos', 'Completá al menos el número y el cliente.');
      return;
    }

    const clientId = Number(formState.clientId.trim());
    if (!Number.isFinite(clientId)) {
      Alert.alert('Cliente inválido', 'Ingresá un identificador numérico de cliente.');
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
      status: 'draft',
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
            Los campos de trabajos, cliente e importe se completaron automáticamente según tu selección.
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
        placeholder="Agregar comentarios o instrucciones para el equipo."
        placeholderTextColor={placeholderColor}
        value={formState.notes}
        onChangeText={handleChange('notes')}
        multiline
        numberOfLines={5}
      />

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
});
