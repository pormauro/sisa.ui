import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { InvoicesContext } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { AfipPointsOfSaleContext } from '@/contexts/AfipPointsOfSaleContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface InvoiceDetailViewProps {
  invoiceId: number;
  onClose?: () => void;
}

const normaliseStatus = (status: string | null | undefined) =>
  (status ?? 'pending').toString().toLowerCase();

const statusLabel = (status: string | null | undefined) => {
  const normalised = normaliseStatus(status);
  if (normalised === 'paid') {
    return 'Pagada';
  }
  if (normalised === 'cancelled' || normalised === 'canceled') {
    return 'Anulada';
  }
  return 'Pendiente';
};

const formatDate = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    if (typeof value === 'string') {
      return value;
    }
    return '—';
  }
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatCurrency = (value: unknown, currencyCode?: string | null) => {
  if (value === undefined || value === null) {
    return '—';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  const resolvedCurrency = currencyCode && typeof currencyCode === 'string' && currencyCode.trim()
    ? currencyCode.trim().toUpperCase()
    : 'ARS';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: resolvedCurrency,
      minimumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return numeric.toFixed(2);
  }
};

const VOUCHER_LABELS: Record<string, string> = {
  '1': 'Factura A (01)',
  '3': 'Nota de Crédito A (03)',
  '6': 'Factura B (06)',
  '8': 'Nota de Crédito B (08)',
  '11': 'Factura C (11)',
  '13': 'Nota de Crédito C (13)',
};

const CONCEPT_LABELS: Record<number, string> = {
  1: 'Productos',
  2: 'Servicios',
  3: 'Productos y servicios',
};

const DOCUMENT_LABELS: Record<string, string> = {
  '80': 'CUIT (80)',
  '86': 'CUIL (86)',
  '96': 'DNI (96)',
  '94': 'Pasaporte (94)',
};

const formatVoucherType = (value: unknown) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const key = String(value);
  return VOUCHER_LABELS[key] ?? key;
};

const formatConceptLabel = (value: unknown) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && CONCEPT_LABELS[numeric]) {
    return CONCEPT_LABELS[numeric];
  }
  return String(value);
};

const formatDocumentTypeLabel = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const key = String(value);
  return DOCUMENT_LABELS[key] ?? key;
};

const formatExchangeRate = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return numeric.toFixed(4);
};

export const InvoiceDetailView: React.FC<InvoiceDetailViewProps> = ({ invoiceId, onClose }) => {
  const { invoices, refreshInvoice, updateInvoiceStatus } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const { points } = useContext(AfipPointsOfSaleContext);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const background = useThemeColor({}, 'background');
  const sectionBackground = useThemeColor({ light: '#f9fafb', dark: 'rgba(255,255,255,0.05)' }, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#4b5563' }, 'background');
  const highlightColor = useThemeColor({ light: '#2563eb', dark: '#60a5fa' }, 'tint');
  const mutedText = useThemeColor({ light: '#6b7280', dark: '#d1d5db' }, 'text');

  const invoice = useMemo(() => invoices.find(item => item.id === invoiceId), [invoiceId, invoices]);
  const canUpdateStatus = permissions.includes('updateInvoice');
  const canListInvoices = permissions.includes('listInvoices');
  const canViewInvoice = permissions.includes('viewInvoice');
  const canView = canListInvoices || canViewInvoice || canUpdateStatus;
  const statusStyles = useMemo(() => {
    const statusKey = normaliseStatus(invoice?.status ?? invoice?.state);
    if (statusKey === 'paid') {
      return { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: 'rgba(22,163,74,0.4)' };
    }
    if (statusKey === 'cancelled' || statusKey === 'canceled') {
      return { backgroundColor: 'rgba(248,113,113,0.18)', borderColor: 'rgba(220,38,38,0.4)' };
    }
    return { backgroundColor: 'rgba(250,204,21,0.18)', borderColor: 'rgba(217,119,6,0.4)' };
  }, [invoice?.state, invoice?.status]);

  const afipPoint = useMemo(() => {
    if (!invoice || !invoice.afip_point_of_sale_id) {
      return null;
    }
    const parsedId =
      typeof invoice.afip_point_of_sale_id === 'number'
        ? invoice.afip_point_of_sale_id
        : Number(invoice.afip_point_of_sale_id);
    if (!Number.isFinite(parsedId)) {
      return null;
    }
    return points.find(point => point.id === parsedId) ?? null;
  }, [invoice, points]);

  const vatBreakdown = useMemo(() => {
    if (!invoice || !Array.isArray(invoice.vat_breakdown)) {
      return [];
    }
    return invoice.vat_breakdown;
  }, [invoice]);

  const tributes = useMemo(() => {
    if (!invoice || !Array.isArray(invoice.tributes)) {
      return [];
    }
    return invoice.tributes;
  }, [invoice]);

  useEffect(() => {
    if (!canView) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver facturas.');
      if (onClose) {
        onClose();
      }
    }
  }, [canView, onClose]);

  useEffect(() => {
    if (!canView) {
      setIsRefreshing(false);
      return;
    }
    let mounted = true;
    setIsRefreshing(true);
    refreshInvoice(invoiceId)
      .catch(error => {
        console.error('Error fetching invoice detail:', error);
      })
      .finally(() => {
        if (mounted) {
          setIsRefreshing(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [canView, invoiceId, refreshInvoice]);

  const clientName = useMemo(() => {
    if (!invoice) {
      return null;
    }
    if (invoice.client_name) {
      return invoice.client_name;
    }
    const clientId = invoice.client_id ?? invoice.clientId;
    if (!clientId) {
      return null;
    }
    return clients.find(client => client.id === Number(clientId))?.business_name ?? null;
  }, [clients, invoice]);

  const providerName = useMemo(() => {
    if (!invoice) {
      return null;
    }
    if (invoice.provider_name) {
      return invoice.provider_name;
    }
    const providerId = invoice.provider_id ?? invoice.providerId;
    if (!providerId) {
      return null;
    }
    return providers.find(provider => provider.id === Number(providerId))?.business_name ?? null;
  }, [invoice, providers]);

  const handleRefresh = () => {
    if (!canView) {
      return;
    }
    setIsRefreshing(true);
    refreshInvoice(invoiceId)
      .catch(error => {
        console.error('Error reloading invoice detail:', error);
        Alert.alert('Error', 'No se pudo actualizar la información de la factura.');
      })
      .finally(() => setIsRefreshing(false));
  };

  const handleMarkPending = () => {
    if (!invoice || !canUpdateStatus) {
      return;
    }

    const statusKey = normaliseStatus(invoice.status ?? invoice.state);
    if (statusKey === 'pending') {
      Alert.alert('Factura pendiente', 'Esta factura ya se encuentra marcada como pendiente.');
      return;
    }

    Alert.alert(
      'Marcar como pendiente',
      '¿Deseas marcar esta factura como pendiente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar',
          style: 'default',
          onPress: async () => {
            setIsUpdating(true);
            const success = await updateInvoiceStatus(invoice.id, 'pending');
            setIsUpdating(false);
            if (!success) {
              return;
            }
            if (onClose) {
              onClose();
            }
          },
        },
      ]
    );
  };

  if (!canView) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: background }]}>
        <ThemedText style={styles.emptyText}>No tienes permiso para ver facturas.</ThemedText>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: background }]}>
        <ThemedText style={styles.emptyText}>No se encontró la factura solicitada.</ThemedText>
      </View>
    );
  }

  const invoiceNumber = invoice.number ?? invoice.invoice_number ?? invoice.code ?? `#${invoice.id}`;
  const description = invoice.description ?? invoice.notes ?? 'Sin descripción';
  const issuedAt = invoice.issued_at ?? invoice.issue_date ?? invoice.date;
  const dueAt = invoice.due_at ?? invoice.due_date;
  const total = invoice.total ?? invoice.total_amount ?? invoice.amount ?? invoice.subtotal;
  const isPending = normaliseStatus(invoice.status ?? invoice.state) === 'pending';
  const resolvedCurrency =
    typeof invoice.currency === 'string' && invoice.currency.trim()
      ? invoice.currency.trim().toUpperCase()
      : 'ARS';
  const voucherLabel = formatVoucherType(invoice.afip_voucher_type);
  const conceptText = formatConceptLabel(invoice.concept);
  const documentTypeLabel = formatDocumentTypeLabel(invoice.customer_document_type);
  const documentNumber =
    invoice.customer_document_number && String(invoice.customer_document_number).trim()
      ? String(invoice.customer_document_number).trim()
      : null;
  const caeValue = invoice.cae ?? '—';
  const caeDue = invoice.cae_due_date ? formatDate(invoice.cae_due_date) : '—';
  const exchangeRateLabel = formatExchangeRate(invoice.exchange_rate);
  const afipPointLabel = afipPoint
    ? `${afipPoint.point_number.toString().padStart(4, '0')} (${afipPoint.receipt_type})`
    : invoice.afip_point_of_sale_id
      ? `ID ${invoice.afip_point_of_sale_id}`
      : '—';

  return (
    <ScrollView
      style={{ backgroundColor: background }}
      contentContainerStyle={[styles.container, { backgroundColor: background }]}
    >
      <View style={[styles.card, { backgroundColor: sectionBackground, borderColor }]}> 
        <View style={styles.header}>
          <ThemedText style={styles.title}>{invoiceNumber}</ThemedText>
          <View style={[styles.statusWrapper, statusStyles]}>
            <ThemedText style={styles.statusLabel}>{statusLabel(invoice.status ?? invoice.state)}</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.subtitle, { color: mutedText }]}>{description}</ThemedText>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>Total</ThemedText>
          <ThemedText style={styles.metaValue}>{formatCurrency(total, resolvedCurrency)}</ThemedText>
        </View>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>Fecha de emisión</ThemedText>
          <ThemedText style={styles.metaValue}>{formatDate(issuedAt)}</ThemedText>
        </View>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>Fecha de vencimiento</ThemedText>
          <ThemedText style={styles.metaValue}>{formatDate(dueAt)}</ThemedText>
        </View>

        {clientName ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Cliente</ThemedText>
            <ThemedText style={styles.metaValue}>{clientName}</ThemedText>
          </View>
        ) : null}

        {providerName ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Proveedor</ThemedText>
            <ThemedText style={styles.metaValue}>{providerName}</ThemedText>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>ID interno</ThemedText>
          <ThemedText style={styles.metaValue}>{invoice.id}</ThemedText>
        </View>

        {invoice.created_at ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Creada</ThemedText>
            <ThemedText style={styles.metaValue}>{formatDate(invoice.created_at)}</ThemedText>
          </View>
        ) : null}

        {invoice.updated_at ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Actualizada</ThemedText>
            <ThemedText style={styles.metaValue}>{formatDate(invoice.updated_at)}</ThemedText>
          </View>
        ) : null}

        <View style={[styles.sectionDivider, { backgroundColor: borderColor }]} />
        <ThemedText style={styles.sectionHeading}>Datos AFIP</ThemedText>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>CAE</ThemedText>
          <ThemedText style={styles.metaValue}>{caeValue}</ThemedText>
        </View>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>Vencimiento CAE</ThemedText>
          <ThemedText style={styles.metaValue}>{caeDue}</ThemedText>
        </View>

        <View style={[styles.metaRow, styles.metaRowMultiline]}>
          <ThemedText style={styles.metaLabel}>Punto de venta AFIP</ThemedText>
          <View style={styles.metaValueGroup}>
            <ThemedText style={styles.metaValue}>{afipPointLabel}</ThemedText>
            {afipPoint?.description ? (
              <ThemedText style={[styles.metaSubValue, { color: mutedText }]}>{afipPoint.description}</ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>Tipo de comprobante</ThemedText>
          <ThemedText style={styles.metaValue}>{voucherLabel}</ThemedText>
        </View>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>Concepto</ThemedText>
          <ThemedText style={styles.metaValue}>{conceptText}</ThemedText>
        </View>

        <View style={[styles.metaRow, styles.metaRowMultiline]}>
          <ThemedText style={styles.metaLabel}>Documento receptor</ThemedText>
          <View style={styles.metaValueGroup}>
            <ThemedText style={styles.metaValue}>{documentTypeLabel}</ThemedText>
            {documentNumber ? (
              <ThemedText style={[styles.metaSubValue, { color: mutedText }]}>{documentNumber}</ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>Moneda</ThemedText>
          <ThemedText style={styles.metaValue}>{resolvedCurrency}</ThemedText>
        </View>

        <View style={styles.metaRow}>
          <ThemedText style={styles.metaLabel}>Cotización</ThemedText>
          <ThemedText style={styles.metaValue}>{exchangeRateLabel}</ThemedText>
        </View>

        {vatBreakdown.length > 0 ? (
          <View style={styles.breakdownSection}>
            <ThemedText style={styles.sectionSubheading}>IVA discriminado</ThemedText>
            {vatBreakdown.map((entry, index) => (
              <View key={`vat-${index}`} style={styles.breakdownRow}>
                <ThemedText style={[styles.breakdownLabel, { color: mutedText }]}>
                  {entry.vat_rate}% sobre {formatCurrency(entry.taxable_amount, resolvedCurrency)}
                </ThemedText>
                <ThemedText style={styles.breakdownValue}>
                  {formatCurrency(entry.vat_amount, resolvedCurrency)}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {tributes.length > 0 ? (
          <View style={styles.breakdownSection}>
            <ThemedText style={styles.sectionSubheading}>Percepciones / Tributos</ThemedText>
            {tributes.map((entry, index) => (
              <View key={`tribute-${index}`} style={styles.breakdownRow}>
                <View style={styles.breakdownInfo}>
                  <ThemedText style={styles.breakdownLabel}>
                    {entry.description ?? 'Tributo informado'}
                  </ThemedText>
                  <ThemedText style={[styles.breakdownSubLabel, { color: mutedText }]}>
                    {entry.type ? `Código ${entry.type}` : 'Sin código asignado'}
                  </ThemedText>
                  {entry.base_amount !== undefined && entry.base_amount !== null ? (
                    <ThemedText style={[styles.breakdownSubLabel, { color: mutedText }]}>
                      Base {formatCurrency(entry.base_amount, resolvedCurrency)}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText style={styles.breakdownValue}>
                  {formatCurrency(entry.amount, resolvedCurrency)}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {canUpdateStatus ? (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { borderColor: highlightColor, opacity: isPending ? 0.6 : 1 },
            ]}
            onPress={handleMarkPending}
            disabled={isUpdating || isPending}
          >
            {isUpdating ? (
              <ActivityIndicator color={highlightColor} />
            ) : (
              <ThemedText style={[styles.primaryButtonText, { color: highlightColor }]}> 
                {isPending ? 'Factura pendiente' : 'Marcar como pendiente'}
              </ThemedText>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: highlightColor }]}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator color={highlightColor} />
          ) : (
            <ThemedText style={[styles.secondaryButtonText, { color: highlightColor }]}>Actualizar</ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 15, marginBottom: 16 },
  statusWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  metaRowMultiline: {
    alignItems: 'flex-start',
    marginTop: 12,
  },
  metaLabel: { fontSize: 14, fontWeight: '600' },
  metaValue: { fontSize: 14 },
  metaValueGroup: { alignItems: 'flex-end' },
  metaSubValue: { fontSize: 12, marginTop: 2 },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionHeading: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  sectionSubheading: { fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  breakdownSection: { marginTop: 12 },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  breakdownInfo: { flex: 1, marginRight: 12 },
  breakdownLabel: { fontSize: 14, fontWeight: '500' },
  breakdownSubLabel: { fontSize: 12, marginTop: 2 },
  breakdownValue: { fontSize: 14, fontWeight: '600' },
  primaryButton: {
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '500' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: { fontSize: 16, textAlign: 'center' },
});

export default InvoiceDetailView;
