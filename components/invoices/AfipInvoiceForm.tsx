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
import { AfipPointsOfSaleContext } from '@/contexts/AfipPointsOfSaleContext';
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
  onSubmit: (payload: CreateAfipInvoicePayload, helpers: {
    items: AfipInvoiceItem[];
    vat_breakdown: AfipVatBreakdownEntry[];
    tributes: AfipTributeEntry[];
  }) => void | Promise<void>;
  onCancel?: () => void;
}

const CONCEPT_OPTIONS = [
  { label: 'Productos', value: '1' },
  { label: 'Servicios', value: '2' },
  { label: 'Productos y servicios', value: '3' },
];

const VOUCHER_TYPES = [
  { label: 'Factura A (01)', value: '1' },
  { label: 'Factura B (06)', value: '6' },
  { label: 'Factura C (11)', value: '11' },
  { label: 'Nota de Crédito A (03)', value: '3' },
  { label: 'Nota de Crédito B (08)', value: '8' },
  { label: 'Nota de Crédito C (13)', value: '13' },
];

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

export const AfipInvoiceForm: React.FC<AfipInvoiceFormProps> = ({
  initialInvoice,
  submitting = false,
  submitLabel = 'Guardar factura',
  onSubmit,
  onCancel,
}) => {
  const { clients } = useContext(ClientsContext);
  const { points, listPoints } = useContext(AfipPointsOfSaleContext);

  const [clientId, setClientId] = useState('');
  const [pointOfSaleId, setPointOfSaleId] = useState('');
  const [voucherType, setVoucherType] = useState('');
  const [concept, setConcept] = useState('1');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [customerDocumentType, setCustomerDocumentType] = useState('');
  const [customerDocumentNumber, setCustomerDocumentNumber] = useState('');
  const [observations, setObservations] = useState('');
  const [items, setItems] = useState<ItemRow[]>([createEmptyItem()]);
  const [tributes, setTributes] = useState<TributeRow[]>([]);

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

  const documentOptions = useMemo(() => DOCUMENT_TYPES, []);

  const conceptOptions = useMemo(() => CONCEPT_OPTIONS, []);

  const voucherOptions = useMemo(() => VOUCHER_TYPES, []);

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

  const handleSubmit = useCallback(() => {
    if (!clientId) {
      Alert.alert('Datos incompletos', 'Debes seleccionar un cliente.');
      return;
    }
    if (!pointOfSaleId) {
      Alert.alert('Datos incompletos', 'Selecciona un punto de venta AFIP.');
      return;
    }
    if (!voucherType) {
      Alert.alert('Datos incompletos', 'Selecciona el tipo de comprobante.');
      return;
    }
    if (!concept) {
      Alert.alert('Datos incompletos', 'Selecciona el concepto de facturación.');
      return;
    }
    if (parsedItems.length === 0) {
      Alert.alert('Detalle vacío', 'Agrega al menos un ítem con cantidad, precio e IVA válidos.');
      return;
    }

    const payload: CreateAfipInvoicePayload = {
      client_id: Number(clientId),
      afip_point_of_sale_id: Number(pointOfSaleId),
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

    onSubmit(payload, {
      items: parsedItems,
      vat_breakdown: vatBreakdown,
      tributes: parsedTributes,
    });
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
    currency,
    exchangeRate,
    issueDate,
    dueDate,
    observations,
    onSubmit,
  ]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Datos del comprobante</ThemedText>
          <ThemedText style={styles.label}>Cliente</ThemedText>
          <SearchableSelect
            items={clientOptions}
            selectedValue={clientId || null}
            onValueChange={value => setClientId(value ? String(value) : '')}
            placeholder="Selecciona cliente"
          />

          <ThemedText style={[styles.label, styles.spacingTop]}>Punto de venta AFIP</ThemedText>
          <SearchableSelect
            items={pointOptions}
            selectedValue={pointOfSaleId || null}
            onValueChange={value => setPointOfSaleId(value ? String(value) : '')}
            placeholder="Selecciona punto de venta"
          />

          <ThemedText style={[styles.label, styles.spacingTop]}>Tipo de comprobante</ThemedText>
          <SearchableSelect
            items={voucherOptions}
            selectedValue={voucherType || null}
            onValueChange={value => setVoucherType(value ? String(value) : '')}
            placeholder="Selecciona tipo de comprobante"
          />

          <ThemedText style={[styles.label, styles.spacingTop]}>Concepto</ThemedText>
          <SearchableSelect
            items={conceptOptions}
            selectedValue={concept || null}
            onValueChange={value => setConcept(value ? String(value) : '')}
            placeholder="Selecciona concepto"
            showSearch={false}
          />

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
                onChangeText={setDueDate}
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
            onChangeText={setCustomerDocumentNumber}
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

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Ítems</ThemedText>
            <TouchableOpacity style={[styles.addButton, { borderColor: accentColor }]} onPress={handleAddItem}>
              <ThemedText style={[styles.addButtonText, { color: accentColor }]}>Agregar ítem</ThemedText>
            </TouchableOpacity>
          </View>
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
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
