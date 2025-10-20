import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ClientsContext } from '@/contexts/ClientsContext';
import { AfipPointOfSale, AfipPointsOfSaleContext } from '@/contexts/AfipPointsOfSaleContext';
import {
  AfipInvoiceItem,
  AfipTributeEntry,
  AfipVatBreakdownEntry,
  CreateAfipInvoicePayload,
  Invoice,
} from '@/contexts/InvoicesContext';

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  measureUnit?: string;
}

interface TributeRow {
  description: string;
  type: string;
  amount: string;
  baseAmount: string;
}

interface AfipInvoiceFormProps {
  initialInvoice?: Partial<Invoice> | null;
  submitting?: boolean;
  submitLabel?: string;
  savingPending?: boolean;
  savePendingLabel?: string;
  onSubmit: (payload: CreateAfipInvoicePayload, helpers: {
    items: AfipInvoiceItem[];
    vat_breakdown: AfipVatBreakdownEntry[];
    tributes: AfipTributeEntry[];
  }) => void | Promise<void>;
  onSavePending?: (payload: CreateAfipInvoicePayload, helpers: {
    items: AfipInvoiceItem[];
    vat_breakdown: AfipVatBreakdownEntry[];
    tributes: AfipTributeEntry[];
  }) => void | Promise<void>;
  onCancel?: () => void;
  onManagePointsOfSale?: () => void;
  managePointsOfSaleLabel?: string;
}

const CONCEPT_OPTIONS = [
  { label: 'Productos', value: '1' },
  { label: 'Servicios', value: '2' },
  { label: 'Productos y servicios', value: '3' },
];

interface VoucherDefinition {
  value: string;
  label: string;
  keywords: string[];
}

const FACTURA_X_VOUCHER_TYPE = '201';

const VOUCHER_DEFINITIONS: VoucherDefinition[] = [
  { value: '1', label: 'Factura A (01)', keywords: ['factura a'] },
  { value: '6', label: 'Factura B (06)', keywords: ['factura b'] },
  { value: '11', label: 'Factura C (11)', keywords: ['factura c'] },
  { value: '3', label: 'Nota de Crédito A (03)', keywords: ['nota de credito a'] },
  { value: '8', label: 'Nota de Crédito B (08)', keywords: ['nota de credito b'] },
  { value: '13', label: 'Nota de Crédito C (13)', keywords: ['nota de credito c'] },
  { value: FACTURA_X_VOUCHER_TYPE, label: 'Factura X (201)', keywords: ['factura x'] },
];

const VOUCHER_KEYWORDS = new Map<string, string[]>(
  VOUCHER_DEFINITIONS.map(definition => [definition.value, definition.keywords])
);

const DOCUMENT_TYPES = [
  { label: 'Sin documento', value: '' },
  { label: 'CUIT (80)', value: '80' },
  { label: 'CUIL (86)', value: '86' },
  { label: 'DNI (96)', value: '96' },
  { label: 'Pasaporte (94)', value: '94' },
];

const createEmptyItem = (): ItemRow => ({
  description: '',
  quantity: '1',
  unitPrice: '0',
  vatRate: '21',
});

const createEmptyTribute = (): TributeRow => ({
  description: '',
  type: '',
  amount: '0',
  baseAmount: '0',
});

const normaliseNumber = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const sanitized = value.replace(',', '.');
  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }
  return value.toFixed(Math.abs(value) >= 1 ? 2 : 4);
};

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateString = (value: string): Date | null => {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some(part => Number.isNaN(part))) {
    return null;
  }
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const computeDueDateFromIssueDate = (issueDate: string): string => {
  const parsedIssue = parseDateString(issueDate) ?? new Date();
  const dueDate = new Date(parsedIssue.getTime());
  dueDate.setDate(dueDate.getDate() + 15);
  return formatDateString(dueDate);
};

type FieldErrorKey = 'client' | 'pointOfSale' | 'voucherType' | 'concept' | 'items';

export const AfipInvoiceForm: React.FC<AfipInvoiceFormProps> = ({
  initialInvoice,
  submitting = false,
  submitLabel = 'Guardar factura',
  savingPending = false,
  savePendingLabel = 'Guardar pendiente',
  onSubmit,
  onSavePending,
  onCancel,
  onManagePointsOfSale,
  managePointsOfSaleLabel = 'Gestionar puntos de venta',
}) => {
  const { clients } = useContext(ClientsContext);
  const { points, listPoints } = useContext(AfipPointsOfSaleContext);

  const [clientId, setClientId] = useState('');
  const [pointOfSaleId, setPointOfSaleId] = useState('');
  const [voucherType, setVoucherType] = useState('');
  const [concept, setConcept] = useState('1');
  const [issueDate, setIssueDate] = useState(() => formatDateString(new Date()));
  const [dueDate, setDueDate] = useState(() => computeDueDateFromIssueDate(formatDateString(new Date())));
  const [currency, setCurrency] = useState('ARS');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [customerDocumentType, setCustomerDocumentType] = useState('80');
  const [customerDocumentNumber, setCustomerDocumentNumber] = useState('');
  const [observations, setObservations] = useState('');
  const [items, setItems] = useState<ItemRow[]>([createEmptyItem()]);
  const [tributes, setTributes] = useState<TributeRow[]>([]);
  const [dueDateManuallySet, setDueDateManuallySet] = useState(false);
  const [customerDocumentManuallySet, setCustomerDocumentManuallySet] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<FieldErrorKey, boolean>>({
    client: false,
    pointOfSale: false,
    voucherType: false,
    concept: false,
    items: false,
  });

  const initialisedRef = useRef(false);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#fff', dark: 'rgba(255,255,255,0.05)' }, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');
  const placeholderColor = useThemeColor({ light: '#9ca3af', dark: '#6b7280' }, 'text');
  const textColor = useThemeColor({}, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const destructiveColor = useThemeColor({ light: '#dc2626', dark: '#f87171' }, 'text');
  const accentColor = useThemeColor({ light: '#2563eb', dark: '#60a5fa' }, 'tint');

  const setFieldError = useCallback((field: FieldErrorKey, value: boolean) => {
    setFieldErrors(prev => (prev[field] === value ? prev : { ...prev, [field]: value }));
  }, []);

  useEffect(() => {
    if (!initialisedRef.current && initialInvoice) {
      if (initialInvoice.client_id) {
        setClientId(String(initialInvoice.client_id));
      }
      if (initialInvoice.afip_point_of_sale_id) {
        setPointOfSaleId(String(initialInvoice.afip_point_of_sale_id));
      }
      if (initialInvoice.afip_voucher_type) {
        setVoucherType(String(initialInvoice.afip_voucher_type));
      }
      if (initialInvoice.concept) {
        setConcept(String(initialInvoice.concept));
      }
      if (initialInvoice.issue_date) {
        setIssueDate(String(initialInvoice.issue_date).slice(0, 10));
      }
      if (initialInvoice.due_date) {
        setDueDate(String(initialInvoice.due_date).slice(0, 10));
        setDueDateManuallySet(true);
      }
      if (initialInvoice.currency) {
        setCurrency(String(initialInvoice.currency));
      }
      if (initialInvoice.exchange_rate) {
        setExchangeRate(String(initialInvoice.exchange_rate));
      }
      if (initialInvoice.customer_document_type) {
        setCustomerDocumentType(String(initialInvoice.customer_document_type));
      }
      if (initialInvoice.customer_document_number) {
        setCustomerDocumentNumber(String(initialInvoice.customer_document_number));
        setCustomerDocumentManuallySet(true);
      }
      if (initialInvoice.notes || initialInvoice.description) {
        setObservations(String(initialInvoice.notes ?? initialInvoice.description ?? ''));
      }
      if (Array.isArray(initialInvoice.items) && initialInvoice.items.length > 0) {
        setItems(
          initialInvoice.items.map(item => ({
            description: item.description ?? '',
            quantity: formatNumber(item.quantity ?? 1),
            unitPrice: formatNumber(item.unit_price ?? 0),
            vatRate: formatNumber(item.vat_rate ?? 21),
            measureUnit: item.measure_unit ?? undefined,
          }))
        );
      }
      if (Array.isArray(initialInvoice.tributes) && initialInvoice.tributes.length > 0) {
        setTributes(
          initialInvoice.tributes.map(tribute => ({
            description: tribute.description ?? '',
            type: tribute.type ? String(tribute.type) : '',
            amount: formatNumber(tribute.amount ?? 0),
            baseAmount: tribute.base_amount ? formatNumber(tribute.base_amount) : '0',
          }))
        );
      }
      initialisedRef.current = true;
    }
  }, [initialInvoice]);

  useEffect(() => {
    if (!points || points.length === 0) {
      void listPoints();
    }
  }, [listPoints, points]);

  const clientOptions = useMemo(
    () =>
      clients.map(client => ({
        label: client.business_name,
        value: client.id.toString(),
      })),
    [clients]
  );

  const pointOptions = useMemo(
    () =>
      points
        .filter(point => point.active)
        .map(point => ({
          label: `${point.point_number.toString().padStart(4, '0')} — ${point.receipt_type}`,
          value: point.id.toString(),
        })),
    [points]
  );

  const isPointCompatible = useCallback(
    (point: AfipPointOfSale, voucher: string): boolean => {
      if (!voucher) {
        return true;
      }
      const keywords = VOUCHER_KEYWORDS.get(voucher);
      if (!keywords || keywords.length === 0) {
        return true;
      }
      const normalizedReceipt = normalizeText(point.receipt_type ?? '');
      if (!normalizedReceipt) {
        return false;
      }
      return keywords.some(keyword => normalizedReceipt.includes(keyword));
    },
    []
  );

  const documentOptions = useMemo(() => DOCUMENT_TYPES, []);

  const conceptOptions = useMemo(() => CONCEPT_OPTIONS, []);

  const voucherOptions = useMemo(
    () => VOUCHER_DEFINITIONS.map(definition => ({ label: definition.label, value: definition.value })),
    []
  );

  const isFacturaXVoucher = voucherType === FACTURA_X_VOUCHER_TYPE;

  useEffect(() => {
    if (!voucherType || isFacturaXVoucher) {
      return;
    }
    const activePoints = points.filter(point => point.active);
    if (activePoints.length === 0) {
      return;
    }
    const currentPoint = activePoints.find(point => String(point.id) === pointOfSaleId);
    if (currentPoint && isPointCompatible(currentPoint, voucherType)) {
      return;
    }
    const fallback = activePoints.find(point => isPointCompatible(point, voucherType));
    if (!fallback) {
      return;
    }
    const fallbackId = String(fallback.id);
    if (fallbackId !== pointOfSaleId) {
      setPointOfSaleId(fallbackId);
    }
    setFieldError('pointOfSale', false);
  }, [
    voucherType,
    isFacturaXVoucher,
    points,
    pointOfSaleId,
    isPointCompatible,
    setFieldError,
    setPointOfSaleId,
  ]);

  useEffect(() => {
    if (clientId) {
      setFieldError('client', false);
    }
  }, [clientId, setFieldError]);

  useEffect(() => {
    if (!dueDateManuallySet) {
      const computedDueDate = computeDueDateFromIssueDate(issueDate);
      if (computedDueDate !== dueDate) {
        setDueDate(computedDueDate);
      }
    }
  }, [dueDate, dueDateManuallySet, issueDate]);

  useEffect(() => {
    if (isFacturaXVoucher) {
      setFieldError('pointOfSale', false);
      return;
    }
    if (pointOfSaleId) {
      setFieldError('pointOfSale', false);
    }
  }, [isFacturaXVoucher, pointOfSaleId, setFieldError]);

  useEffect(() => {
    if (isFacturaXVoucher && pointOfSaleId) {
      setPointOfSaleId('');
    }
  }, [isFacturaXVoucher, pointOfSaleId, setPointOfSaleId]);

  useEffect(() => {
    if (voucherType) {
      setFieldError('voucherType', false);
    }
  }, [voucherType, setFieldError]);

  useEffect(() => {
    if (concept) {
      setFieldError('concept', false);
    }
  }, [concept, setFieldError]);

  const handleClientChange = useCallback(
    (value: string | number | null) => {
      const id = value ? String(value) : '';
      setClientId(id);
      setCustomerDocumentManuallySet(false);
      if (id) {
        const selectedClient = clients.find(client => String(client.id) === id);
        setCustomerDocumentNumber(selectedClient?.tax_id ?? '');
      } else {
        setCustomerDocumentNumber('');
      }
    },
    [clients]
  );

  const handleDueDateChange = useCallback((value: string) => {
    setDueDateManuallySet(value.trim().length > 0);
    setDueDate(value);
  }, []);

  const handleCustomerDocumentNumberChange = useCallback((value: string) => {
    setCustomerDocumentManuallySet(value.trim().length > 0);
    setCustomerDocumentNumber(value);
  }, []);

  useEffect(() => {
    if (!clientId || customerDocumentManuallySet) {
      return;
    }
    const selectedClient = clients.find(client => String(client.id) === clientId);
    if (selectedClient?.tax_id && selectedClient.tax_id !== customerDocumentNumber) {
      setCustomerDocumentNumber(selectedClient.tax_id);
    }
  }, [clientId, clients, customerDocumentManuallySet, customerDocumentNumber]);

  const parsedItems = useMemo(() => {
    return items
      .map(item => {
        const quantity = normaliseNumber(item.quantity);
        const unitPrice = normaliseNumber(item.unitPrice);
        const vatRate = normaliseNumber(item.vatRate);
        if (quantity === null || unitPrice === null || vatRate === null) {
          return null;
        }
        const net = quantity * unitPrice;
        const vatAmount = Number((net * (vatRate / 100)).toFixed(2));
        const total = Number((net + vatAmount).toFixed(2));
        return {
          description: item.description.trim(),
          quantity,
          unit_price: unitPrice,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total_amount: total,
          measure_unit: item.measureUnit,
          net,
        };
      })
      .filter((item): item is (AfipInvoiceItem & { net: number }) => Boolean(item) && item.description.length > 0);
  }, [items]);

  useEffect(() => {
    if (parsedItems.length > 0) {
      setFieldError('items', false);
    }
  }, [parsedItems, setFieldError]);

  const vatBreakdown = useMemo(() => {
    const map = new Map<number, { taxable: number; vat: number }>();
    parsedItems.forEach(item => {
      const entry = map.get(item.vat_rate) ?? { taxable: 0, vat: 0 };
      entry.taxable += item.net;
      entry.vat += item.vat_amount ?? 0;
      map.set(item.vat_rate, entry);
    });
    return Array.from(map.entries()).map(([rate, totals]) => ({
      vat_rate: rate,
      taxable_amount: Number(totals.taxable.toFixed(2)),
      vat_amount: Number(totals.vat.toFixed(2)),
      total_amount: Number((totals.taxable + totals.vat).toFixed(2)),
    }));
  }, [parsedItems]);

  const parsedTributes = useMemo(() => {
    return tributes
      .map(tribute => {
        const amount = normaliseNumber(tribute.amount);
        if (amount === null || amount <= 0) {
          return null;
        }
        const baseAmount = normaliseNumber(tribute.baseAmount);
        return {
          description: tribute.description.trim() || undefined,
          type: tribute.type.trim() || undefined,
          amount: Number(amount.toFixed(2)),
          base_amount: baseAmount !== null ? Number(baseAmount.toFixed(2)) : undefined,
        };
      })
      .filter((entry): entry is AfipTributeEntry => Boolean(entry));
  }, [tributes]);

  const resolvedCurrency = (currency.trim() || 'ARS').toUpperCase();

  const totals = useMemo(() => {
    const taxable = parsedItems.reduce((sum, item) => sum + item.net, 0);
    const vatTotal = parsedItems.reduce((sum, item) => sum + (item.vat_amount ?? 0), 0);
    const tributeTotal = parsedTributes.reduce((sum, tribute) => sum + tribute.amount, 0);
    return {
      taxable: Number(taxable.toFixed(2)),
      vat: Number(vatTotal.toFixed(2)),
      tributes: Number(tributeTotal.toFixed(2)),
      total: Number((taxable + vatTotal + tributeTotal).toFixed(2)),
    };
  }, [parsedItems, parsedTributes]);

  const formatCurrencyValue = (value: number) => {
    try {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: resolvedCurrency,
        minimumFractionDigits: 2,
      }).format(value);
    } catch {
      return value.toFixed(2);
    }
  };

  const handleAddItem = useCallback(() => {
    setItems(prev => [...prev, createEmptyItem()]);
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setItems(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev));
  }, []);

  const handleItemChange = useCallback((index: number, next: Partial<ItemRow>) => {
    setItems(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, ...next } : item))
    );
  }, []);

  const handleAddTribute = useCallback(() => {
    setTributes(prev => [...prev, createEmptyTribute()]);
  }, []);

  const handleRemoveTribute = useCallback((index: number) => {
    setTributes(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleTributeChange = useCallback((index: number, next: Partial<TributeRow>) => {
    setTributes(prev => prev.map((tribute, idx) => (idx === index ? { ...tribute, ...next } : tribute)));
  }, []);

  const handleVoucherTypeChange = useCallback(
    (value: string | null) => {
      const nextValue = value ? String(value) : '';
      setVoucherType(nextValue);
      if (nextValue === FACTURA_X_VOUCHER_TYPE) {
        setPointOfSaleId('');
        setFieldError('pointOfSale', false);
      }
    },
    [setFieldError, setPointOfSaleId]
  );

  const buildPayload = useCallback((): CreateAfipInvoicePayload | null => {
    const missingClient = !clientId;
    const requiresPointOfSale = voucherType !== FACTURA_X_VOUCHER_TYPE;
    const missingPoint = requiresPointOfSale && !pointOfSaleId;
    const missingVoucher = !voucherType;
    const missingConcept = !concept;

    if (missingClient || missingPoint || missingVoucher || missingConcept) {
      setFieldErrors(prev => ({
        ...prev,
        client: prev.client || missingClient,
        pointOfSale: requiresPointOfSale ? prev.pointOfSale || missingPoint : false,
        voucherType: prev.voucherType || missingVoucher,
        concept: prev.concept || missingConcept,
      }));
      Alert.alert('Datos incompletos', 'Revisa los campos marcados como obligatorios.');
      return null;
    }

    if (parsedItems.length === 0) {
      setFieldError('items', true);
      Alert.alert('Detalle vacío', 'Agrega al menos un ítem con cantidad, precio e IVA válidos.');
      return null;
    }

    const pointOfSalePayload = requiresPointOfSale && pointOfSaleId ? Number(pointOfSaleId) : null;

    return {
      client_id: Number(clientId),
      afip_point_of_sale_id: pointOfSalePayload,
      afip_voucher_type: voucherType,
      concept: Number(concept),
      items: parsedItems,
      vat_breakdown: vatBreakdown,
      tributes: parsedTributes,
      customer_document_type: customerDocumentType ? customerDocumentType : undefined,
      customer_document_number: customerDocumentNumber.trim() || undefined,
      currency: resolvedCurrency,
      exchange_rate: normaliseNumber(exchangeRate) ?? undefined,
      issue_date: issueDate.trim() || undefined,
      due_date: dueDate.trim() || undefined,
      observations: observations.trim() || undefined,
    };

  }, [
    clientId,
    pointOfSaleId,
    voucherType,
    concept,
    parsedItems,
    vatBreakdown,
    parsedTributes,
    customerDocumentType,
    customerDocumentNumber,
    resolvedCurrency,
    exchangeRate,
    issueDate,
    dueDate,
    observations,
    setFieldError,
    setFieldErrors,
  ]);

  const handleSubmit = useCallback(() => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    onSubmit(payload, {
      items: parsedItems,
      vat_breakdown: vatBreakdown,
      tributes: parsedTributes,
    });
  }, [buildPayload, onSubmit, parsedItems, parsedTributes, vatBreakdown]);

  const handleSavePending = useCallback(() => {
    if (!onSavePending) {
      return;
    }
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    onSavePending(payload, {
      items: parsedItems,
      vat_breakdown: vatBreakdown,
      tributes: parsedTributes,
    });
  }, [buildPayload, onSavePending, parsedItems, parsedTributes, vatBreakdown]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={styles.sectionTitle}>Datos del comprobante</ThemedText>
          <ThemedText style={[styles.label, fieldErrors.client ? { color: destructiveColor } : null]}>Cliente</ThemedText>
          <SearchableSelect
            items={clientOptions}
            selectedValue={clientId || null}
            onValueChange={handleClientChange}
            placeholder="Selecciona cliente"
            hasError={fieldErrors.client}
            errorColor={destructiveColor}
          />
          {fieldErrors.client ? (
            <ThemedText style={[styles.errorText, { color: destructiveColor }]}>Selecciona un cliente.</ThemedText>
          ) : null}

          <ThemedText
            style={[
              styles.label,
              styles.spacingTop,
              fieldErrors.voucherType ? { color: destructiveColor } : null,
            ]}
          >
            Tipo de comprobante
          </ThemedText>
          <SearchableSelect
            items={voucherOptions}
            selectedValue={voucherType || null}
            onValueChange={handleVoucherTypeChange}
            placeholder="Selecciona tipo de comprobante"
            hasError={fieldErrors.voucherType}
            errorColor={destructiveColor}
          />
          {fieldErrors.voucherType ? (
            <ThemedText style={[styles.errorText, { color: destructiveColor }]}>Selecciona el tipo de comprobante.</ThemedText>
          ) : null}

          {!isFacturaXVoucher ? (
            <>
              <View style={[styles.pointOfSaleHeader, styles.spacingTop]}>
                <ThemedText
                  style={[styles.label, fieldErrors.pointOfSale ? { color: destructiveColor } : null]}
                >
                  Punto de venta AFIP
                </ThemedText>
                {onManagePointsOfSale ? (
                  <TouchableOpacity onPress={onManagePointsOfSale} style={styles.manageLink}>
                    <ThemedText style={[styles.manageLinkText, { color: accentColor }]}>
                      {managePointsOfSaleLabel}
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
              <SearchableSelect
                items={pointOptions}
                selectedValue={pointOfSaleId || null}
                onValueChange={value => setPointOfSaleId(value ? String(value) : '')}
                placeholder="Selecciona punto de venta"
                hasError={fieldErrors.pointOfSale}
                errorColor={destructiveColor}
              />
              {fieldErrors.pointOfSale ? (
                <ThemedText style={[styles.errorText, { color: destructiveColor }]}>Selecciona un punto de venta válido.</ThemedText>
              ) : null}
            </>
          ) : null}

          <ThemedText
            style={[
              styles.label,
              styles.spacingTop,
              fieldErrors.concept ? { color: destructiveColor } : null,
            ]}
          >
            Concepto
          </ThemedText>
          <SearchableSelect
            items={conceptOptions}
            selectedValue={concept || null}
            onValueChange={value => setConcept(value ? String(value) : '')}
            placeholder="Selecciona concepto"
            showSearch={false}
            hasError={fieldErrors.concept}
            errorColor={destructiveColor}
          />
          {fieldErrors.concept ? (
            <ThemedText style={[styles.errorText, { color: destructiveColor }]}>Selecciona el concepto de facturación.</ThemedText>
          ) : null}

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <ThemedText style={styles.label}>Fecha de emisión</ThemedText>
              <TextInput
                value={issueDate}
                onChangeText={setIssueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={placeholderColor}
                style={[styles.input, { borderColor, color: textColor }]}
              />
            </View>
            <View style={styles.halfInput}>
              <ThemedText style={styles.label}>Vencimiento</ThemedText>
              <TextInput
                value={dueDate}
                onChangeText={handleDueDateChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={placeholderColor}
                style={[styles.input, { borderColor, color: textColor }]}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <ThemedText style={styles.label}>Moneda</ThemedText>
              <TextInput
                value={currency}
                onChangeText={text => setCurrency(text.toUpperCase())}
                placeholder="ARS"
                placeholderTextColor={placeholderColor}
                style={[styles.input, { borderColor, color: textColor }]}
              />
            </View>
            <View style={styles.halfInput}>
              <ThemedText style={styles.label}>Cotización</ThemedText>
              <TextInput
                value={exchangeRate}
                onChangeText={setExchangeRate}
                placeholder="1.00"
                keyboardType="decimal-pad"
                placeholderTextColor={placeholderColor}
                style={[styles.input, { borderColor, color: textColor }]}
              />
            </View>
          </View>

          <ThemedText style={[styles.label, styles.spacingTop]}>Documento del receptor</ThemedText>
          <SearchableSelect
            items={documentOptions}
            selectedValue={customerDocumentType || null}
            onValueChange={value => setCustomerDocumentType(value ? String(value) : '')}
            placeholder="Selecciona tipo de documento"
            showSearch={false}
          />
          <TextInput
            value={customerDocumentNumber}
            onChangeText={handleCustomerDocumentNumberChange}
            placeholder="Número de documento"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor, color: textColor }]}
            keyboardType="default"
          />

          <ThemedText style={[styles.label, styles.spacingTop]}>Observaciones</ThemedText>
          <TextInput
            value={observations}
            onChangeText={setObservations}
            placeholder="Notas internas o descripción"
            placeholderTextColor={placeholderColor}
            style={[styles.input, styles.multiline, { borderColor, color: textColor }]}
            multiline
          />
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBackground,
              borderColor: fieldErrors.items ? destructiveColor : borderColor,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Ítems</ThemedText>
            <TouchableOpacity style={[styles.addButton, { borderColor: accentColor }]} onPress={handleAddItem}>
              <ThemedText style={[styles.addButtonText, { color: accentColor }]}>Agregar ítem</ThemedText>
            </TouchableOpacity>
          </View>
          {fieldErrors.items ? (
            <ThemedText style={[styles.errorText, { color: destructiveColor }]}>Agrega al menos un ítem válido.</ThemedText>
          ) : null}
          {items.map((item, index) => (
            <View key={`item-${index}`} style={[styles.itemCard, { borderColor }]}> 
              <ThemedText style={styles.label}>Descripción</ThemedText>
              <TextInput
                value={item.description}
                onChangeText={text => handleItemChange(index, { description: text })}
                placeholder="Detalle del producto o servicio"
                placeholderTextColor={placeholderColor}
                style={[styles.input, styles.multiline, { borderColor, color: textColor }]}
                multiline
              />
              <View style={styles.row}>
                <View style={styles.thirdInput}>
                  <ThemedText style={styles.label}>Cantidad</ThemedText>
                  <TextInput
                    value={item.quantity}
                    onChangeText={text => handleItemChange(index, { quantity: text })}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={placeholderColor}
                    style={[styles.input, { borderColor, color: textColor }]}
                  />
                </View>
                <View style={styles.thirdInput}>
                  <ThemedText style={styles.label}>Precio unitario</ThemedText>
                  <TextInput
                    value={item.unitPrice}
                    onChangeText={text => handleItemChange(index, { unitPrice: text })}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={placeholderColor}
                    style={[styles.input, { borderColor, color: textColor }]}
                  />
                </View>
                <View style={styles.thirdInput}>
                  <ThemedText style={styles.label}>IVA %</ThemedText>
                  <TextInput
                    value={item.vatRate}
                    onChangeText={text => handleItemChange(index, { vatRate: text })}
                    keyboardType="decimal-pad"
                    placeholder="21"
                    placeholderTextColor={placeholderColor}
                    style={[styles.input, { borderColor, color: textColor }]}
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveItem(index)}
                style={styles.removeButton}
              >
                <ThemedText style={[styles.removeButtonText, { color: destructiveColor }]}>Eliminar ítem</ThemedText>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Percepciones / Tributos</ThemedText>
            <TouchableOpacity style={[styles.addButton, { borderColor: accentColor }]} onPress={handleAddTribute}>
              <ThemedText style={[styles.addButtonText, { color: accentColor }]}>Agregar tributo</ThemedText>
            </TouchableOpacity>
          </View>
          {tributes.length === 0 ? (
            <ThemedText style={styles.emptyHelper}>
              Añade percepciones o impuestos adicionales solo si aplica al comprobante.
            </ThemedText>
          ) : null}
          {tributes.map((tribute, index) => (
            <View key={`tribute-${index}`} style={[styles.itemCard, { borderColor }]}> 
              <ThemedText style={styles.label}>Descripción</ThemedText>
              <TextInput
                value={tribute.description}
                onChangeText={text => handleTributeChange(index, { description: text })}
                placeholder="Percepción IIBB, Impuesto Municipal, etc."
                placeholderTextColor={placeholderColor}
                style={[styles.input, styles.multiline, { borderColor, color: textColor }]}
                multiline
              />
              <View style={styles.row}>
                <View style={styles.thirdInput}>
                  <ThemedText style={styles.label}>Tipo</ThemedText>
                  <TextInput
                    value={tribute.type}
                    onChangeText={text => handleTributeChange(index, { type: text })}
                    placeholder="Código"
                    placeholderTextColor={placeholderColor}
                    style={[styles.input, { borderColor, color: textColor }]}
                  />
                </View>
                <View style={styles.thirdInput}>
                  <ThemedText style={styles.label}>Importe</ThemedText>
                  <TextInput
                    value={tribute.amount}
                    onChangeText={text => handleTributeChange(index, { amount: text })}
                    placeholder="0.00"
                    placeholderTextColor={placeholderColor}
                    keyboardType="decimal-pad"
                    style={[styles.input, { borderColor, color: textColor }]}
                  />
                </View>
                <View style={styles.thirdInput}>
                  <ThemedText style={styles.label}>Base imponible</ThemedText>
                  <TextInput
                    value={tribute.baseAmount}
                    onChangeText={text => handleTributeChange(index, { baseAmount: text })}
                    placeholder="0.00"
                    placeholderTextColor={placeholderColor}
                    keyboardType="decimal-pad"
                    style={[styles.input, { borderColor, color: textColor }]}
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveTribute(index)}
                style={styles.removeButton}
              >
                <ThemedText style={[styles.removeButtonText, { color: destructiveColor }]}>Eliminar tributo</ThemedText>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Resumen</ThemedText>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Subtotal neto</ThemedText>
            <ThemedText style={styles.summaryValue}>{formatCurrencyValue(totals.taxable)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>IVA</ThemedText>
            <ThemedText style={styles.summaryValue}>{formatCurrencyValue(totals.vat)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Percepciones</ThemedText>
            <ThemedText style={styles.summaryValue}>{formatCurrencyValue(totals.tributes)}</ThemedText>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}> 
            <ThemedText style={styles.summaryLabel}>Total</ThemedText>
            <ThemedText style={styles.summaryValue}>{formatCurrencyValue(totals.total)}</ThemedText>
          </View>
        </View>

        <View style={styles.actions}>
          {onCancel ? (
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.secondaryButton, { borderColor }]}
              disabled={submitting}
            >
              <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>Cancelar</ThemedText>
            </TouchableOpacity>
          ) : null}
          {onSavePending ? (
            <TouchableOpacity
              onPress={handleSavePending}
              style={[styles.pendingButton, { borderColor: accentColor, opacity: savingPending ? 0.7 : 1 }]}
              disabled={savingPending || submitting}
            >
              <ThemedText style={[styles.pendingButtonText, { color: accentColor }]}>
                {savingPending ? 'Guardando…' : savePendingLabel}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.primaryButton, { backgroundColor: buttonColor, opacity: submitting ? 0.7 : 1 }]}
            disabled={submitting}
          >
            <ThemedText style={[styles.primaryButtonText, { color: buttonTextColor }]}>
              {submitting ? 'Procesando…' : submitLabel}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

export default AfipInvoiceForm;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 12,
  },
  spacingTop: {
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  thirdInput: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  manageLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  manageLinkText: {
    fontSize: 13,
    fontWeight: '500',
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  removeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyHelper: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  pointOfSaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 15,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  pendingButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  pendingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
