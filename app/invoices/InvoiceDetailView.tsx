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
import {
  formatConceptLabel,
  formatDocumentTypeLabel,
  formatExchangeRate,
  formatInvoiceCurrency,
  formatInvoiceDate,
  formatVoucherType,
} from '@/utils/invoiceFormatting';
import { invoiceSharedStyles } from '@/components/invoices/InvoiceSharedStyles';

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

export const InvoiceDetailView: React.FC<InvoiceDetailViewProps> = ({ invoiceId, onClose }) => {
  const { invoices, refreshInvoice, updateInvoiceStatus, reprintInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);
  const { points } = useContext(AfipPointsOfSaleContext);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showExpiryBanner, setShowExpiryBanner] = useState(false);
  const [expiryDismissed, setExpiryDismissed] = useState(false);
  const [isReprinting, setIsReprinting] = useState(false);

  const background = useThemeColor({}, 'background');
  const sectionBackground = useThemeColor({ light: '#f9fafb', dark: 'rgba(255,255,255,0.05)' }, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#4b5563' }, 'background');
  const highlightColor = useThemeColor({ light: '#2563eb', dark: '#60a5fa' }, 'tint');
  const mutedText = useThemeColor({ light: '#6b7280', dark: '#d1d5db' }, 'text');
  const bannerBackground = useThemeColor({ light: 'rgba(37,99,235,0.08)', dark: 'rgba(96,165,250,0.18)' }, 'background');

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
    setExpiryDismissed(false);
  }, [invoice?.id]);

  useEffect(() => {
    if (!invoice || expiryDismissed) {
      setShowExpiryBanner(false);
      return;
    }
    if (!invoice.cae_due_date) {
      setShowExpiryBanner(false);
      return;
    }
    const dueDate = new Date(invoice.cae_due_date);
    if (Number.isNaN(dueDate.getTime())) {
      setShowExpiryBanner(false);
      return;
    }
    const now = Date.now();
    const diffMs = dueDate.getTime() - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    setShowExpiryBanner(diffDays <= 5);
  }, [expiryDismissed, invoice]);

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

  const handleReprint = async () => {
    if (!invoice) {
      return;
    }
    try {
      setIsReprinting(true);
      const success = await reprintInvoice(invoice.id);
      if (success) {
        Alert.alert('Reimpresión solicitada', 'Se envió la orden de reimpresión a AFIP.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo reimprimir el comprobante.';
      Alert.alert('Error de reimpresión', message);
    } finally {
      setIsReprinting(false);
    }
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
  const caeDue = invoice.cae_due_date ? formatInvoiceDate(invoice.cae_due_date) : '—';
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
      <View
        style={[invoiceSharedStyles.card, styles.card, { backgroundColor: sectionBackground, borderColor }]}
      >
        {showExpiryBanner ? (
          <View
            style={[styles.expiryBanner, { borderColor: highlightColor, backgroundColor: bannerBackground }]}
          >
            <View style={styles.expiryMessage}>
              <ThemedText style={[styles.expiryTitle, { color: highlightColor }]}>CAE por vencer</ThemedText>
              <ThemedText style={styles.expiryDescription}>
                El comprobante vence el {caeDue}. Reimprime el ticket para evitar rechazos.
              </ThemedText>
            </View>
            <View style={styles.expiryActions}>
              <TouchableOpacity
                style={[styles.expiryButton, { borderColor: highlightColor }]}
                onPress={handleReprint}
                disabled={isReprinting}
              >
                {isReprinting ? (
                  <ActivityIndicator color={highlightColor} />
                ) : (
                  <ThemedText style={[styles.expiryButtonText, { color: highlightColor }]}>Reimprimir</ThemedText>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setExpiryDismissed(true)}>
                <ThemedText style={[styles.dismissText, { color: mutedText }]}>Ocultar</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <View style={styles.header}>
          <ThemedText style={styles.title}>{invoiceNumber}</ThemedText>
          <View style={[styles.statusWrapper, statusStyles]}>
            <ThemedText style={styles.statusLabel}>{statusLabel(invoice.status ?? invoice.state)}</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.subtitle, { color: mutedText }]}>{description}</ThemedText>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Total</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>
            {formatInvoiceCurrency(total, resolvedCurrency)}
          </ThemedText>
        </View>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Fecha de emisión</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{formatInvoiceDate(issuedAt)}</ThemedText>
        </View>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Fecha de vencimiento</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{formatInvoiceDate(dueAt)}</ThemedText>
        </View>

        {clientName ? (
          <View style={invoiceSharedStyles.metaRow}>
            <ThemedText style={invoiceSharedStyles.metaLabel}>Cliente</ThemedText>
            <ThemedText style={invoiceSharedStyles.metaValue}>{clientName}</ThemedText>
          </View>
        ) : null}

        {providerName ? (
          <View style={invoiceSharedStyles.metaRow}>
            <ThemedText style={invoiceSharedStyles.metaLabel}>Proveedor</ThemedText>
            <ThemedText style={invoiceSharedStyles.metaValue}>{providerName}</ThemedText>
          </View>
        ) : null}

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>ID interno</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{invoice.id}</ThemedText>
        </View>

        {invoice.created_at ? (
          <View style={invoiceSharedStyles.metaRow}>
            <ThemedText style={invoiceSharedStyles.metaLabel}>Creada</ThemedText>
            <ThemedText style={invoiceSharedStyles.metaValue}>{formatInvoiceDate(invoice.created_at)}</ThemedText>
          </View>
        ) : null}

        {invoice.updated_at ? (
          <View style={invoiceSharedStyles.metaRow}>
            <ThemedText style={invoiceSharedStyles.metaLabel}>Actualizada</ThemedText>
            <ThemedText style={invoiceSharedStyles.metaValue}>{formatInvoiceDate(invoice.updated_at)}</ThemedText>
          </View>
        ) : null}

        <View style={[invoiceSharedStyles.sectionDivider, { backgroundColor: borderColor }]} />
        <ThemedText style={invoiceSharedStyles.sectionHeading}>Datos AFIP</ThemedText>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>CAE</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{caeValue}</ThemedText>
        </View>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Vencimiento CAE</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{caeDue}</ThemedText>
        </View>

        <View style={[invoiceSharedStyles.metaRow, invoiceSharedStyles.metaRowMultiline]}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Punto de venta AFIP</ThemedText>
          <View style={invoiceSharedStyles.metaValueGroup}>
            <ThemedText style={invoiceSharedStyles.metaValue}>{afipPointLabel}</ThemedText>
            {afipPoint?.description ? (
              <ThemedText style={[invoiceSharedStyles.metaSubValue, { color: mutedText }]}>
                {afipPoint.description}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Tipo de comprobante</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{voucherLabel}</ThemedText>
        </View>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Concepto</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{conceptText}</ThemedText>
        </View>

        <View style={[invoiceSharedStyles.metaRow, invoiceSharedStyles.metaRowMultiline]}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Documento receptor</ThemedText>
          <View style={invoiceSharedStyles.metaValueGroup}>
            <ThemedText style={invoiceSharedStyles.metaValue}>{documentTypeLabel}</ThemedText>
            {documentNumber ? (
              <ThemedText style={[invoiceSharedStyles.metaSubValue, { color: mutedText }]}>
                {documentNumber}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Moneda</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{resolvedCurrency}</ThemedText>
        </View>

        <View style={invoiceSharedStyles.metaRow}>
          <ThemedText style={invoiceSharedStyles.metaLabel}>Cotización</ThemedText>
          <ThemedText style={invoiceSharedStyles.metaValue}>{exchangeRateLabel}</ThemedText>
        </View>

        {vatBreakdown.length > 0 ? (
          <View style={styles.breakdownSection}>
            <ThemedText style={styles.sectionSubheading}>IVA discriminado</ThemedText>
            {vatBreakdown.map((entry, index) => (
              <View key={`vat-${index}`} style={styles.breakdownRow}>
                <ThemedText style={[styles.breakdownLabel, { color: mutedText }]}>
                  {entry.vat_rate}% sobre {formatInvoiceCurrency(entry.taxable_amount, resolvedCurrency)}
                </ThemedText>
                <ThemedText style={styles.breakdownValue}>
                  {formatInvoiceCurrency(entry.vat_amount, resolvedCurrency)}
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
                      Base {formatInvoiceCurrency(entry.base_amount, resolvedCurrency)}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText style={styles.breakdownValue}>
                  {formatInvoiceCurrency(entry.amount, resolvedCurrency)}
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
    marginBottom: 20,
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
  expiryBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expiryMessage: { flex: 1, marginRight: 12 },
  expiryTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  expiryDescription: { fontSize: 13 },
  expiryActions: { alignItems: 'flex-end' },
  expiryButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiryButtonText: { fontSize: 14, fontWeight: '600' },
  dismissText: { fontSize: 12, textDecorationLine: 'underline' },
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
