import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { JobsContext, type Job } from '@/contexts/JobsContext';
import { TariffsContext, type Tariff } from '@/contexts/TariffsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ThemedText } from '@/components/ThemedText';
import { FileGallery } from '@/components/FileGallery';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import {
  InvoiceItemFormValue,
  calculateInvoiceItemsSubtotal,
  calculateInvoiceItemsTax,
  calculateInvoiceItemsTotal,
  hasInvoiceItemData,
  prepareInvoiceItemPayloads,
  parseInvoiceDecimalInput,
  parseInvoicePercentageInput,
} from '@/utils/invoiceItems';
import { calculateJobTotal, parseJobIdsParam } from '@/utils/jobTotals';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';
import { isStatusFacturado } from '@/utils/statuses';

type InvoiceRouteParams = {
  jobIds?: string | string[];
  clientId?: string | string[];
};

type JobStatusUpdateResult = {
  total: number;
  updated: number;
  skipped: number;
  missing: number;
  statusFound: boolean;
};

const extractDatePart = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.includes(' ')) {
    const [datePart] = trimmed.split(' ');
    return datePart ?? '';
  }

  if (trimmed.includes('T')) {
    const [datePart] = trimmed.split('T');
    return datePart ?? '';
  }

  return trimmed;
};

const getJobDateLabel = (job: Job): string => {
  const candidates = [job.job_date, job.created_at, job.updated_at];
  for (const candidate of candidates) {
    const normalized = extractDatePart(candidate ?? undefined);
    if (normalized) {
      return normalized;
    }
  }
  return '';
};

const getJobItemAmount = (job: Job, tariffAmountById: Map<number, number>): number => {
  const computedTotal = calculateJobTotal(job, tariffAmountById);
  if (Number.isFinite(computedTotal) && (computedTotal as number) > 0) {
    return computedTotal as number;
  }

  const manualAmount = typeof job.manual_amount === 'number' ? job.manual_amount : undefined;
  if (typeof manualAmount === 'number' && Number.isFinite(manualAmount) && manualAmount > 0) {
    return manualAmount;
  }

  if (typeof job.manual_amount === 'string') {
    const parsedManual = Number(job.manual_amount.trim());
    if (Number.isFinite(parsedManual) && parsedManual > 0) {
      return parsedManual;
    }
  }

  if (job.tariff_id != null) {
    const tariffAmount = tariffAmountById.get(job.tariff_id);
    if (typeof tariffAmount === 'number' && Number.isFinite(tariffAmount) && tariffAmount > 0) {
      return tariffAmount;
    }
  }

  return 0;
};

const formatNumberForInput = (value: number): string => {
  return value.toFixed(2).replace('.', ',');
};

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
  taxPercentage: string;
  taxAmount: string;
}

const getToday = (): string => {
  const today = new Date();
  return today.toISOString().slice(0, 10);
};

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

const DEFAULT_FORM_STATE: InvoiceFormState = {
  id: '',
  invoiceDate: getToday(),
  dueDate: '',
  clientId: '',
  invoiceNumber: '',
  currencyCode: 'ARS',
  companyId: '',
  status: 'draft',
  notes: '',
  taxPercentage: '',
  taxAmount: '',
};

const NEW_CLIENT_VALUE = '__new_client__';

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<InvoiceRouteParams>();
  const { addInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { jobs, loadJobs, updateJob } = useContext(JobsContext);
  const { tariffs, loadTariffs } = useContext(TariffsContext);
  const { clients } = useContext(ClientsContext);
  const { statuses } = useContext(StatusesContext);
  const { beginSelection, consumeSelection, pendingSelections, cancelSelection } = usePendingSelection();

  const jobIdsFromParams = useMemo(() => parseJobIdsParam(params.jobIds), [params.jobIds]);
  const jobIdsKey = useMemo(() => jobIdsFromParams.join(','), [jobIdsFromParams]);
  const clientIdFromParams = useMemo(() => {
    const raw = params.clientId;
    const normalized = Array.isArray(raw) ? raw[0] : raw;
    return normalized ? normalized.toString() : undefined;
  }, [params.clientId]);

  const [formState, setFormState] = useState<InvoiceFormState>(DEFAULT_FORM_STATE);
  const [items, setItems] = useState<InvoiceItemFormValue[]>([createEmptyItem()]);
  const [expandedMetadata, setExpandedMetadata] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [clientPrefilled, setClientPrefilled] = useState(false);
  const [itemsPrefilled, setItemsPrefilled] = useState(false);
  const [clientsInitialized, setClientsInitialized] = useState(false);
  const initialClientsRef = useRef(clients);
  const [attachedFiles, setAttachedFiles] = useState<string>('');

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#D0D0D0', dark: '#444444' }, 'background');
  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888888', dark: '#AAAAAA' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryText = useThemeColor({ light: '#6B7280', dark: '#94A3B8' }, 'text');

  const canCreate = permissions.includes('addInvoice');

  const tariffAmountById = useMemo(() => {
    const map = new Map<number, number>();
    tariffs.forEach((tariff: Tariff) => {
      map.set(tariff.id, tariff.amount);
    });
    return map;
  }, [tariffs]);

  const facturadoStatusId = useMemo(() => {
    for (const status of statuses) {
      if (isStatusFacturado(status)) {
        return status.id;
      }
    }
    return null;
  }, [statuses]);

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

  const currencyItems = useMemo(
    () => [
      { label: '🇦🇷 ARS (Peso argentino)', value: 'ARS' },
      { label: '🇺🇸 USA (USD)', value: 'USD' },
    ],
    [],
  );

  const statusItems = useMemo(() => {
    const base = [
      { label: 'Borrador', value: 'draft' },
      { label: 'Emitida', value: 'issued' },
      { label: 'Pagado', value: 'paid' },
      { label: 'Cancelado', value: 'canceled' },
    ];
    if (formState.status && !base.some(item => item.value === formState.status)) {
      base.push({ label: formState.status, value: formState.status });
    }
    return base;
  }, [formState.status]);

  useEffect(() => {
    setItemsPrefilled(false);
  }, [jobIdsKey]);

  useEffect(() => {
    if (jobIdsFromParams.length > 0) {
      void loadJobs();
      void loadTariffs();
    }
  }, [jobIdsFromParams, loadJobs, loadTariffs]);

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear facturas.');
      router.back();
    }
  }, [canCreate, router]);

  useEffect(
    () => () => {
      cancelSelection();
    },
    [cancelSelection],
  );

  useEffect(() => {
    setClientPrefilled(false);
  }, [clientIdFromParams]);

  useEffect(() => {
    if (clientsInitialized) {
      return;
    }

    if (clients.length > 0 || clients !== initialClientsRef.current) {
      setClientsInitialized(true);
    }
  }, [clients, clientsInitialized]);

  useEffect(() => {
    if (clientPrefilled) {
      return;
    }
    if (!clientIdFromParams) {
      return;
    }

    setFormState(current => ({ ...current, clientId: clientIdFromParams }));
    setClientPrefilled(true);
  }, [clientIdFromParams, clientPrefilled]);

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
    if (!clientsInitialized) {
      return;
    }

    if (!formState.clientId) {
      return;
    }
    const exists = clients.some(client => client.id.toString() === formState.clientId);
    if (!exists) {
      setFormState(current => ({ ...current, clientId: '' }));
    }
  }, [clients, clientsInitialized, formState.clientId]);

  useEffect(() => {
    if (itemsPrefilled) {
      return;
    }
    if (jobIdsFromParams.length === 0) {
      return;
    }

    const selectedJobs = jobIdsFromParams
      .map(id => jobs.find(job => job.id === id))
      .filter((job): job is Job => Boolean(job));

    if (selectedJobs.length === 0) {
      return;
    }

    const jobsWithTotals = selectedJobs.map(job => ({
      job,
      total: getJobItemAmount(job, tariffAmountById),
    }));

    const waitingForTariffs = jobsWithTotals.some(({ job, total }) => {
      if (total > 0) {
        return false;
      }
      if (job.tariff_id == null) {
        return false;
      }
      const tariffAmount = tariffAmountById.get(job.tariff_id);
      return typeof tariffAmount !== 'number' || !Number.isFinite(tariffAmount) || tariffAmount <= 0;
    });

    if (waitingForTariffs) {
      return;
    }

    const invoiceItems = jobsWithTotals.map(({ job, total }, index) => {
      const unitPriceText = formatNumberForInput(total);
      const descriptionParts = [
        getJobDateLabel(job),
        job.description?.trim() || 'Trabajo sin descripción',
        formatCurrency(total),
      ].filter(Boolean);

      return {
        description: descriptionParts.join(' - '),
        quantity: '1',
        unitPrice: unitPriceText,
        productId: '',
        discountAmount: '0',
        taxAmount: '0',
        totalAmount: unitPriceText,
        orderIndex: (index + 1).toString(),
      } satisfies InvoiceItemFormValue;
    });

    setItems(invoiceItems);
    setExpandedItems({});
    setItemsPrefilled(true);
  }, [itemsPrefilled, jobIdsFromParams, jobs, tariffAmountById]);

  const manualTaxAmount = useMemo(() => parseInvoiceDecimalInput(formState.taxAmount), [formState.taxAmount]);

  const subtotal = useMemo(() => calculateInvoiceItemsSubtotal(items), [items]);
  const parsedTaxPercentage = useMemo(() => {
    if (!formState.taxPercentage.trim()) {
      return null;
    }
    return parseInvoicePercentageInput(formState.taxPercentage);
  }, [formState.taxPercentage]);
  const taxes = useMemo(() => {
    if (manualTaxAmount !== null) {
      return Math.max(0, manualTaxAmount);
    }
    if (parsedTaxPercentage !== null && Number.isFinite(subtotal)) {
      return Math.max(0, subtotal * (parsedTaxPercentage / 100));
    }
    return calculateInvoiceItemsTax(items);
  }, [items, manualTaxAmount, parsedTaxPercentage, subtotal]);
  const total = useMemo(() => {
    if (manualTaxAmount !== null && Number.isFinite(subtotal)) {
      return Math.max(0, subtotal + Math.max(0, manualTaxAmount));
    }
    if (parsedTaxPercentage !== null && Number.isFinite(subtotal)) {
      const computedTaxes = Math.max(0, subtotal * (parsedTaxPercentage / 100));
      return Math.max(0, subtotal + computedTaxes);
    }
    return calculateInvoiceItemsTotal(items);
  }, [items, manualTaxAmount, parsedTaxPercentage, subtotal]);

  const formattedSubtotal = useMemo(() => formatCurrency(subtotal), [subtotal]);
  const formattedTaxes = useMemo(() => formatCurrency(taxes), [taxes]);
  const formattedTotal = useMemo(() => formatCurrency(total), [total]);

  const computeSuggestedTaxAmount = useCallback((): number | null => {
    if (parsedTaxPercentage !== null && Number.isFinite(subtotal)) {
      return Math.max(0, subtotal * (parsedTaxPercentage / 100));
    }

    const derived = calculateInvoiceItemsTax(items);
    return Number.isFinite(derived) && derived >= 0 ? derived : null;
  }, [items, parsedTaxPercentage, subtotal]);

  const isValid = useMemo(() => {
    if (!formState.clientId.trim()) {
      return false;
    }
    if (!items.some(item => hasInvoiceItemData(item))) {
      return false;
    }
    return true;
  }, [formState.clientId, items]);

  const handleChange = (key: keyof InvoiceFormState) => (value: string) => {
    setFormState(current => ({ ...current, [key]: value }));
  };

  const handleFillTaxAmount = useCallback(() => {
    const suggested = computeSuggestedTaxAmount();
    if (suggested === null) {
      Alert.alert(
        'Sin datos suficientes',
        'Ingresá un porcentaje de impuestos o completa los montos de los ítems para calcular el IVA.',
      );
      return;
    }

    const formatted = formatNumberForInput(suggested);
    setFormState(current => ({ ...current, taxAmount: formatted }));
  }, [computeSuggestedTaxAmount]);

  const markJobsAsInvoiced = useCallback(async (): Promise<JobStatusUpdateResult> => {
    if (jobIdsFromParams.length === 0) {
      return { total: 0, updated: 0, skipped: 0, missing: 0, statusFound: true };
    }

    if (facturadoStatusId === null) {
      return {
        total: 0,
        updated: 0,
        skipped: 0,
        missing: jobIdsFromParams.length,
        statusFound: false,
      };
    }

    const jobsToUpdate = jobIdsFromParams
      .map(id => jobs.find(job => job.id === id))
      .filter((job): job is Job => Boolean(job));

    let updated = 0;
    let skipped = 0;

    for (const job of jobsToUpdate) {
      if (job.status_id === facturadoStatusId) {
        skipped += 1;
        continue;
      }

      const {
        id: jobId,
        user_id: _userId,
        created_at: _createdAt,
        updated_at: _updatedAt,
        voided_at: _voidedAt,
        ...jobData
      } = job;

      const payload: Omit<Job, 'id' | 'user_id'> = {
        ...jobData,
        status_id: facturadoStatusId,
      };

      const success = await updateJob(jobId, payload);
      if (success) {
        updated += 1;
      }
    }

    return {
      total: jobsToUpdate.length,
      updated,
      skipped,
      missing: jobIdsFromParams.length - jobsToUpdate.length,
      statusFound: true,
    };
  }, [facturadoStatusId, jobIdsFromParams, jobs, updateJob]);

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
    if (!canCreate) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear facturas.');
      return;
    }
    if (!isValid) {
      Alert.alert(
        'Datos incompletos',
        'Seleccioná un cliente y agregá al menos un ítem con información válida.',
      );
      return;
    }

    const clientId = Number(formState.clientId.trim());
    if (!Number.isFinite(clientId)) {
      Alert.alert('Cliente inválido', 'Seleccioná un cliente válido.');
      return;
    }

    const payloadItems = prepareInvoiceItemPayloads(items);
    if (payloadItems.length === 0) {
      Alert.alert('Ítems incompletos', 'Agregá al menos un ítem válido antes de crear la factura.');
      return;
    }

    const payload: InvoicePayload = {
      client_id: clientId,
      invoice_date: formState.invoiceDate.trim() || null,
      due_date: formState.dueDate.trim() || null,
      currency_code: formState.currencyCode.trim() || null,
      status: formState.status.trim() || 'draft',
      subtotal_amount: Number.isFinite(subtotal) ? subtotal : null,
      tax_amount: Number.isFinite(taxes) ? taxes : null,
      tax_percentage: parsedTaxPercentage !== null ? parsedTaxPercentage : null,
      total_amount: Number.isFinite(total) ? total : null,
      items: payloadItems,
      attached_files: attachedFiles || null,
    };

    const invoiceNumber = formState.invoiceNumber.trim();
    if (invoiceNumber) {
      payload.invoice_number = invoiceNumber;
    }

    if (formState.companyId.trim()) {
      const parsedCompanyId = Number(formState.companyId.trim());
      if (Number.isFinite(parsedCompanyId)) {
        payload.company_id = parsedCompanyId;
      }
    }

    if (jobIdsFromParams.length > 0) {
      payload.job_ids = jobIdsFromParams;
    }

    const metadata: Record<string, unknown> = {};
    const notes = formState.notes.trim();
    if (notes) {
      metadata.notes = notes;
    }

    if (parsedTaxPercentage !== null) {
      metadata.total_tax_percentage = parsedTaxPercentage;
      metadata.tax_percentage = parsedTaxPercentage;
    }

    if (Object.keys(metadata).length > 0) {
      payload.metadata = metadata;
    }

    setSubmitting(true);
    const created = await addInvoice(payload);
    setSubmitting(false);

    if (created) {
      const messageLines = ['El comprobante quedó en estado borrador.'];

      if (jobIdsFromParams.length > 0) {
        const result = await markJobsAsInvoiced();

        if (!result.statusFound) {
          messageLines.push(
            'No se encontró un estado "Facturado" para actualizar los trabajos seleccionados.',
          );
        } else if (result.total === 0) {
          if (result.missing > 0) {
            messageLines.push(
              'No se encontraron los trabajos seleccionados para actualizar su estado.',
            );
          }
        } else {
          if (result.updated > 0) {
            messageLines.push('Los trabajos seleccionados se marcaron como facturados.');
          }

          const failedUpdates = result.total - result.updated - result.skipped;
          if (failedUpdates > 0) {
            messageLines.push(
              'Algunos trabajos no se pudieron marcar como facturados. Revisalos manualmente.',
            );
          }

          if (result.skipped > 0) {
            messageLines.push('Los trabajos que ya estaban facturados se omitieron automáticamente.');
          }

          if (result.missing > 0) {
            messageLines.push(
              'Algunos trabajos ya no estaban disponibles para actualizar su estado.',
            );
          }
        }
      }

      Alert.alert('Factura creada', messageLines.join('\n'));
      router.replace('/invoices');
      return;
    }

    Alert.alert('Error', 'No fue posible crear la factura. Revisá los datos e intentá nuevamente.');
  };

  return (
    <ScrollView
      style={{ backgroundColor: background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedText style={styles.sectionTitle}>Factura</ThemedText>

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
          <SearchableSelect
            style={styles.select}
            items={currencyItems}
            selectedValue={formState.currencyCode}
            onValueChange={value => {
              const stringValue = typeof value === 'number' ? value.toString() : (value ?? '').toString();
              setFormState(current => ({ ...current, currencyCode: stringValue || 'ARS' }));
            }}
            placeholder="Seleccioná una moneda"
            showSearch={false}
          />

          <ThemedText style={styles.label}>Estado</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={statusItems}
            selectedValue={formState.status}
            onValueChange={value => {
              const stringValue = typeof value === 'number' ? value.toString() : (value ?? '').toString();
              setFormState(current => ({ ...current, status: stringValue || 'draft' }));
            }}
            placeholder="Seleccioná un estado"
            showSearch={false}
          />

          <ThemedText style={styles.label}>Porcentaje de impuestos (total)</ThemedText>
          <TextInput
            style={[styles.input, { borderColor, backgroundColor: inputBackground, color: textColor }]}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            value={formState.taxPercentage}
            onChangeText={handleChange('taxPercentage')}
            keyboardType="decimal-pad"
          />

          <ThemedText style={styles.label}>Impuestos (monto total)</ThemedText>
          <View style={styles.taxRow}>
            <TextInput
              style={[
                styles.input,
                styles.taxInput,
                { borderColor, backgroundColor: inputBackground, color: textColor },
              ]}
              placeholder="0,00"
              placeholderTextColor={placeholderColor}
              value={formState.taxAmount}
              onChangeText={handleChange('taxAmount')}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={[styles.taxButton, { backgroundColor: buttonColor }]}
              onPress={handleFillTaxAmount}
            >
              <ThemedText style={[styles.taxButtonText, { color: buttonTextColor }]}>Calcular IVA</ThemedText>
            </TouchableOpacity>
          </View>
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

      <ThemedText style={styles.label}>Archivos adjuntos</ThemedText>
      <FileGallery
        entityType="invoice"
        entityId={0}
        filesJson={attachedFiles}
        onChangeFilesJson={setAttachedFiles}
        editable
      />

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
          placeholder="Agregar notas internas"
          placeholderTextColor={placeholderColor}
          value={formState.notes}
          onChangeText={handleChange('notes')}
          multiline
          numberOfLines={4}
        />
      ) : null}

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
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taxInput: {
    flex: 1,
    marginRight: 12,
  },
  taxButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  taxButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
});
