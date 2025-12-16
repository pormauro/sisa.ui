import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  InvoicesContext,
  type Invoice,
  type InvoicePayload,
} from '@/contexts/InvoicesContext';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { FileContext } from '@/contexts/FilesContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SearchableSelect } from '@/components/SearchableSelect';
import { FileGallery } from '@/components/FileGallery';
import { useThemeColor } from '@/hooks/useThemeColor';
import { BASE_URL } from '@/config/Index';
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
  parseInvoiceDecimalInput,
  parseInvoicePercentageInput,
} from '@/utils/invoiceItems';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';
import { ensureAuthResponse } from '@/utils/auth/tokenGuard';
import { openAttachment } from '@/utils/files/openAttachment';
import { fileStorage } from '@/utils/files/storage';
import { Buffer } from 'buffer';

const formatNumberForInput = (value: number): string => value.toFixed(2).replace('.', ',');

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.warn('No se pudo interpretar la respuesta JSON del PDF de factura.', error);
    return null;
  }
};

const extractFileId = (data: unknown): number | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const candidate = extractFileId(item);
      if (candidate !== null) {
        return candidate;
      }
    }
    return null;
  }

  const record = data as Record<string, unknown>;
  const directKeys = ['invoice_pdf_file_id', 'pdf_file_id', 'file_id', 'id', 'invoice_pdf_id'];
  for (const key of directKeys) {
    const raw = record[key];
    const parsed = typeof raw === 'string' ? Number(raw) : (raw as number | null);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const nestedKeys = ['invoice', 'data', 'result'];
  for (const nestedKey of nestedKeys) {
    const nested = record[nestedKey];
    const candidate = extractFileId(nested);
    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
};

const parseFileName = (disposition: string | null, fallback: string): string => {
  if (!disposition) {
    return fallback;
  }

  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  if (!match) {
    return fallback;
  }

  try {
    return decodeURIComponent(match[1] || match[2]);
  } catch (error) {
    console.warn('No se pudo decodificar el nombre de archivo del PDF.', error);
    return match[1] || match[2] || fallback;
  }
};

const normalizeFileId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const resolveInvoicePdfFileId = (invoice: Invoice | undefined): number | null => {
  const metadataFileId =
    invoice?.metadata && typeof invoice.metadata === 'object'
      ? normalizeFileId(
          (invoice.metadata as Record<string, unknown>).invoice_pdf_file_id ??
            (invoice.metadata as Record<string, unknown>).pdf_file_id ??
            (invoice.metadata as Record<string, unknown>).invoice_pdf_id ??
            (invoice.metadata as Record<string, unknown>).file_id,
        )
      : null;

  const existingFileId = normalizeFileId(invoice?.invoice_pdf_file_id) ?? metadataFileId;
  return existingFileId;
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

const extractTaxPercentage = (invoice: Invoice | undefined): string => {
  const direct = invoice?.tax_percentage;
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return direct.toString();
  }

  if (!invoice?.metadata || typeof invoice.metadata !== 'object') {
    return '';
  }
  const metadata = invoice.metadata as Record<string, unknown>;
  const rawValue =
    metadata.total_tax_percentage ??
    metadata.tax_percentage ??
    metadata.taxPercent ??
    metadata.totalTaxPercentage ??
    null;

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue.toString();
  }

  if (typeof rawValue === 'string') {
    return rawValue;
  }

  return '';
};

const extractTaxAmount = (invoice: Invoice | undefined): string => {
  const amount = invoice?.tax_amount;
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return formatNumberForInput(amount);
  }
  return '';
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
  taxPercentage: extractTaxPercentage(invoice),
  taxAmount: extractTaxAmount(invoice),
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
  const { token } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { getFile, getFileMetadata } = useContext(FileContext);
  const { beginSelection, consumeSelection, pendingSelections, cancelSelection } = usePendingSelection();

  const [formState, setFormState] = useState<InvoiceFormState>(buildInitialState(undefined));
  const [items, setItems] = useState<InvoiceItemFormValue[]>([createEmptyItem()]);
  const [expandedMetadata, setExpandedMetadata] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string>('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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
  const canDownloadPdf = permissions.includes('downloadInvoicePdf');

  const currentInvoice = useMemo(
    () => invoices.find(invoice => invoice.id === invoiceId),
    [invoiceId, invoices],
  );

  const existingInvoicePdfFileId = useMemo(() => resolveInvoicePdfFileId(currentInvoice), [currentInvoice]);

  const hasSubtotalData = useMemo(() => invoiceItemsProvideSubtotalData(items), [items]);
  const parsedTaxPercentage = useMemo(() => {
    if (!formState.taxPercentage.trim()) {
      return null;
    }
    return parseInvoicePercentageInput(formState.taxPercentage);
  }, [formState.taxPercentage]);
  const manualTaxAmount = useMemo(
    () => parseInvoiceDecimalInput(formState.taxAmount),
    [formState.taxAmount],
  );
  const hasTaxData = useMemo(() => {
    if (manualTaxAmount !== null) {
      return true;
    }
    if (parsedTaxPercentage !== null) {
      return true;
    }
    return invoiceItemsProvideTaxData(items);
  }, [items, manualTaxAmount, parsedTaxPercentage]);

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
    if (manualTaxAmount !== null) {
      return Math.max(0, manualTaxAmount);
    }

    if (parsedTaxPercentage !== null && Number.isFinite(subtotal)) {
      return Math.max(0, subtotal * (parsedTaxPercentage / 100));
    }

    const derivedTaxes = calculateInvoiceItemsTax(items);
    if (hasTaxData) {
      return derivedTaxes;
    }

    const existingTaxes = currentInvoice?.tax_amount;
    return typeof existingTaxes === 'number' && Number.isFinite(existingTaxes)
      ? existingTaxes
      : derivedTaxes;
  }, [currentInvoice, hasTaxData, items, manualTaxAmount, parsedTaxPercentage, subtotal]);
  const total = useMemo(() => {
    if (manualTaxAmount !== null && Number.isFinite(subtotal)) {
      return Math.max(0, subtotal + Math.max(0, manualTaxAmount));
    }

    if (parsedTaxPercentage !== null && Number.isFinite(subtotal)) {
      const computedTaxes = Math.max(0, subtotal * (parsedTaxPercentage / 100));
      return Math.max(0, subtotal + computedTaxes);
    }

    const derivedTotal = calculateInvoiceItemsTotal(items);
    if (hasSubtotalData || hasTaxData) {
      return derivedTotal;
    }

    const existingTotal = currentInvoice?.total_amount;
    return typeof existingTotal === 'number' && Number.isFinite(existingTotal)
      ? existingTotal
      : derivedTotal;
  }, [currentInvoice, hasSubtotalData, hasTaxData, items, manualTaxAmount, parsedTaxPercentage, subtotal]);

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
      if (Array.isArray(currentInvoice.attached_files)) {
        const normalized = currentInvoice.attached_files
          .map(fileId => (typeof fileId === 'number' ? fileId : Number(fileId)))
          .filter(value => Number.isFinite(value));
        setAttachedFiles(normalized.length > 0 ? JSON.stringify(normalized) : '');
      } else if (typeof currentInvoice.attached_files === 'string') {
        try {
          const parsed = JSON.parse(currentInvoice.attached_files);
          if (Array.isArray(parsed)) {
            const normalized = parsed
              .map(fileId => (typeof fileId === 'number' ? fileId : Number(fileId)))
              .filter(value => Number.isFinite(value));
            setAttachedFiles(normalized.length > 0 ? JSON.stringify(normalized) : '');
          } else {
            setAttachedFiles('');
          }
        } catch {
          setAttachedFiles('');
        }
      } else {
        setAttachedFiles('');
      }
      const shouldExpandMetadata =
        (typeof currentInvoice.invoice_number === 'string' &&
          currentInvoice.invoice_number.trim().length > 0) ||
        (typeof currentInvoice.currency === 'string' && currentInvoice.currency.trim().length > 0) ||
        (typeof currentInvoice.status === 'string' && currentInvoice.status !== 'draft') ||
        extractTaxPercentage(currentInvoice).trim().length > 0;
      setExpandedMetadata(shouldExpandMetadata);
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
        'Ingresá un porcentaje de impuestos o completá los ítems con montos para calcular el IVA.',
      );
      return;
    }

    const formatted = formatNumberForInput(suggested);
    setFormState(current => ({ ...current, taxAmount: formatted }));
  }, [computeSuggestedTaxAmount]);

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

  const downloadInvoicePdf = useCallback(
    async ({ forceRegenerate = false }: { forceRegenerate?: boolean } = {}) => {
      if (!invoiceId) {
        Alert.alert('Factura no encontrada', 'No se pudo determinar qué factura descargar.');
        return;
      }

      if (!canDownloadPdf) {
        Alert.alert('Acceso denegado', 'No tenés permiso para descargar comprobantes.');
        return;
      }

      if (!token) {
        Alert.alert('Sesión inválida', 'Iniciá sesión nuevamente para descargar el PDF.');
        return;
      }

      const existingFileId = existingInvoicePdfFileId;

      const tryOpenFileId = async (fileId: number): Promise<boolean> => {
        const [uri, meta] = await Promise.all([getFile(fileId), getFileMetadata(fileId)]);
        if (!uri) {
          return false;
        }

        await openAttachment({
          uri,
          mimeType: meta?.file_type ?? 'application/pdf',
          fileName: meta?.original_name ?? `factura_${invoiceId}.pdf`,
          kind: 'pdf',
        });
        return true;
      };

      setDownloadingPdf(true);
      try {
        if (existingFileId && !forceRegenerate) {
          const opened = await tryOpenFileId(existingFileId);
          if (opened) {
            return;
          }
        }

        const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/report/pdf`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/pdf',
          },
        });

        await ensureAuthResponse(response);
        const contentType = response.headers.get('content-type') ?? 'application/pdf';

        if (contentType.toLowerCase().includes('application/json')) {
          const data = await parseJsonSafely(response);
          const generatedFileId = extractFileId(data);
          if (generatedFileId) {
            await loadInvoices();
            const opened = await tryOpenFileId(generatedFileId);
            if (opened) {
              return;
            }
          }

          throw new Error('La API no devolvió un archivo PDF descargable.');
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          throw new Error('El PDF devuelto está vacío.');
        }

        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = (contentType.split(';')[0] || 'application/pdf').trim();
        const fileName = parseFileName(
          response.headers.get('content-disposition'),
          `factura_${invoiceId}.pdf`,
        );
        const storagePath = `${fileStorage.documentDirectory ?? ''}invoice_${invoiceId}_${Date.now()}.pdf`;
        const { uri } = await fileStorage.write(storagePath, base64, mimeType);

        await openAttachment({
          uri,
          mimeType,
          fileName,
          kind: 'pdf',
        });
      } catch (error) {
        console.error('Error al abrir el PDF de la factura:', error);
        Alert.alert('No se pudo abrir el PDF', 'Verificá tu conexión o los permisos y volvé a intentar.');
      } finally {
        setDownloadingPdf(false);
      }
    },
    [
      canDownloadPdf,
      currentInvoice,
      existingInvoicePdfFileId,
      getFile,
      getFileMetadata,
      invoiceId,
      loadInvoices,
      token,
    ],
  );

  const handleOpenInvoicePdf = useCallback(() => {
    void downloadInvoicePdf();
  }, [downloadInvoicePdf]);

  const handleRegenerateInvoicePdf = useCallback(() => {
    Alert.alert(
      'Rehacer PDF',
      '¿Querés rehacer el PDF de esta factura? Se generará una nueva versión del comprobante.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rehacer',
          style: 'destructive',
          onPress: () => {
            void downloadInvoicePdf({ forceRegenerate: true });
          },
        },
      ],
    );
  }, [downloadInvoicePdf]);

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
      Alert.alert('Datos incompletos', 'Seleccioná un cliente y agregá al menos un ítem válido.');
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
      client_id: clientId,
      invoice_date: formState.invoiceDate.trim() || null,
      due_date: formState.dueDate.trim() || null,
      currency_code: formState.currencyCode.trim() || null,
      status: formState.status.trim() || 'draft',
      tax_percentage: parsedTaxPercentage !== null ? parsedTaxPercentage : null,
      items: payloadItems,
      attached_files: attachedFiles || null,
    };

    const invoiceNumber = formState.invoiceNumber.trim();
    if (invoiceNumber) {
      payload.invoice_number = invoiceNumber;
    }

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
      const normalizedTax =
        manualTaxAmount !== null
          ? Math.max(0, manualTaxAmount)
          : Number.isFinite(taxes)
          ? taxes
          : currentInvoice?.tax_amount ?? null;
      payload.tax_amount = normalizedTax;
    }

    if (formState.companyId.trim()) {
      const parsedCompanyId = Number(formState.companyId.trim());
      if (Number.isFinite(parsedCompanyId)) {
        payload.company_id = parsedCompanyId;
      }
    }

    const metadata: Record<string, unknown> =
      currentInvoice?.metadata && typeof currentInvoice.metadata === 'object'
        ? { ...(currentInvoice.metadata as Record<string, unknown>) }
        : {};

    const notes = formState.notes.trim();
    if (notes) {
      metadata.notes = notes;
    } else {
      delete metadata.notes;
    }

    if (parsedTaxPercentage !== null) {
      metadata.total_tax_percentage = parsedTaxPercentage;
      metadata.tax_percentage = parsedTaxPercentage;
    } else {
      delete metadata.total_tax_percentage;
      delete metadata.tax_percentage;
    }

    if (Object.keys(metadata).length > 0) {
      payload.metadata = metadata;
    } else {
      payload.metadata = null;
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
    <>
      <ScrollView style={{ backgroundColor: background }} contentContainerStyle={styles.container}>
        <ThemedText style={styles.sectionTitle}>Factura Nro {formState.id || invoiceId}</ThemedText>

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
              <ThemedText style={styles.itemTitle}>Ítem {index + 1}</ThemedText>
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
      <FileGallery entityType="invoice" entityId={invoiceId} filesJson={attachedFiles} />

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

      {canDownloadPdf ? (
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor }]}
          onPress={handleOpenInvoicePdf}
          disabled={downloadingPdf}
        >
          {downloadingPdf ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>
              {existingInvoicePdfFileId ? 'Ver PDF' : 'Generar PDF'}
            </ThemedText>
          )}
        </TouchableOpacity>
      ) : null}

      {canDownloadPdf && existingInvoicePdfFileId ? (
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor }]}
          onPress={handleRegenerateInvoicePdf}
          disabled={downloadingPdf}
        >
          {downloadingPdf ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>Rehacer PDF</ThemedText>
          )}
        </TouchableOpacity>
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

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </>
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
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
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
  bottomSpacing: {
    height: 24,
  },
});
