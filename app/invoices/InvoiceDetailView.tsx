import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { InvoicesContext } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ProvidersContext } from '@/contexts/ProvidersContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatInvoiceCurrency, formatInvoiceDate } from '@/utils/invoiceFormatting';
import { invoiceSharedStyles } from '@/components/invoices/InvoiceSharedStyles';

interface InvoiceDetailViewProps {
  invoiceId: number;
  onClose?: () => void;
}

const normaliseStatus = (status: string | null | undefined) =>
  (status ?? 'issued').toString().toLowerCase();

const statusLabel = (status: string | null | undefined) => {
  const normalised = normaliseStatus(status);
  if (normalised === 'paid') {
    return 'Pagada';
  }
  if (normalised === 'cancelled' || normalised === 'canceled') {
    return 'Anulada';
  }
  return 'Emitida';
};

const resolveNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const InvoiceDetailView: React.FC<InvoiceDetailViewProps> = ({ invoiceId, onClose }) => {
  const { invoices, refreshInvoice } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { providers } = useContext(ProvidersContext);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const background = useThemeColor({}, 'background');
  const sectionBackground = useThemeColor({ light: '#f9fafb', dark: 'rgba(255,255,255,0.05)' }, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#4b5563' }, 'background');
  const highlightColor = useThemeColor({ light: '#2563eb', dark: '#60a5fa' }, 'tint');
  const mutedText = useThemeColor({ light: '#6b7280', dark: '#d1d5db' }, 'text');
  const quantityFormatter = useMemo(
    () =>
      new Intl.NumberFormat('es-AR', {
        maximumFractionDigits: 4,
      }),
    []
  );

  const invoice = useMemo(() => invoices.find(item => item.id === invoiceId), [invoiceId, invoices]);
  const canManageInvoices = permissions.includes('updateInvoice') || permissions.includes('createInvoice');
  const canListInvoices = permissions.includes('listInvoices');
  const canViewInvoice = permissions.includes('viewInvoice');
  const canView = canListInvoices || canViewInvoice || canManageInvoices;
  const statusStyles = useMemo(() => {
    const statusKey = normaliseStatus(invoice?.status ?? invoice?.state);
    if (statusKey === 'paid') {
      return { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: 'rgba(22,163,74,0.4)' };
    }
    if (statusKey === 'cancelled' || statusKey === 'canceled') {
      return { backgroundColor: 'rgba(248,113,113,0.18)', borderColor: 'rgba(220,38,38,0.4)' };
    }
    return { backgroundColor: 'rgba(37,99,235,0.15)', borderColor: 'rgba(37,99,235,0.35)' };
  }, [invoice?.state, invoice?.status]);

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
  const resolvedCurrency =
    typeof invoice.currency === 'string' && invoice.currency.trim()
      ? invoice.currency.trim().toUpperCase()
      : 'ARS';
  const invoiceItems = Array.isArray(invoice.items) ? invoice.items : [];
  const itemsSubtotal = invoiceItems.reduce((sum, item) => {
    const quantity = resolveNumber((item as Record<string, unknown>)?.['quantity'] ?? item.quantity);
    const unitPrice = resolveNumber((item as Record<string, unknown>)?.['unit_price'] ?? item.unit_price);
    if (quantity === null || unitPrice === null) {
      return sum;
    }
    return sum + quantity * unitPrice;
  }, 0);
  const vatTotal = vatBreakdown.reduce((sum, entry) => {
    const amount = resolveNumber(entry.vat_amount);
    return amount === null ? sum : sum + amount;
  }, 0);
  const tributesTotal = tributes.reduce((sum, entry) => {
    const amount = resolveNumber(entry.amount);
    return amount === null ? sum : sum + amount;
  }, 0);
  const subtotalCandidate = resolveNumber(invoice.subtotal) ?? resolveNumber(invoice.amount);
  const resolvedSubtotal = subtotalCandidate ?? itemsSubtotal;
  const vatCandidate = resolveNumber(invoice.vat_amount);
  const resolvedVat = vatCandidate ?? vatTotal;
  const resolvedTributes = tributesTotal;
  const totalCandidate =
    resolveNumber(invoice.total) ??
    resolveNumber(invoice.total_amount) ??
    resolveNumber((invoice as Record<string, unknown>)?.['grand_total']);
  const resolvedTotal = totalCandidate ?? resolvedSubtotal + resolvedVat + resolvedTributes;

  return (
    <ScrollView
      style={{ backgroundColor: background }}
      contentContainerStyle={[styles.container, { backgroundColor: background }]}
    >
      <View
        style={[invoiceSharedStyles.card, styles.card, { backgroundColor: sectionBackground, borderColor }]}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>{invoiceNumber}</ThemedText>
          <View style={[styles.statusWrapper, statusStyles]}>
            <ThemedText style={styles.statusLabel}>{statusLabel(invoice.status ?? invoice.state)}</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.subtitle, { color: mutedText }]}>{description}</ThemedText>

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

        <View style={[invoiceSharedStyles.sectionDivider, { backgroundColor: borderColor }]} />
        <ThemedText style={invoiceSharedStyles.sectionHeading}>Detalle de ítems</ThemedText>
        {invoiceItems.length > 0 ? (
          <View style={styles.itemsSection}>
            {invoiceItems.map((item, index) => {
              const quantity = resolveNumber((item as Record<string, unknown>)?.['quantity'] ?? item.quantity);
              const unitPrice = resolveNumber((item as Record<string, unknown>)?.['unit_price'] ?? item.unit_price);
              const lineSubtotal =
                quantity !== null && unitPrice !== null ? Number((quantity * unitPrice).toFixed(2)) : null;
              const quantityLabel = quantity !== null ? quantityFormatter.format(quantity) : null;
              const unitLabel = quantity !== null && item.measure_unit ? ` ${item.measure_unit}` : '';
              const unitPriceLabel = unitPrice !== null ? formatInvoiceCurrency(unitPrice, resolvedCurrency) : null;
              const metaLabel =
                quantityLabel === null && unitPriceLabel === null
                  ? 'Sin datos de unidades y precio'
                  : `${quantityLabel ?? '—'}${quantityLabel !== null ? unitLabel : ''} × ${unitPriceLabel ?? '—'}`;
              const subtotalLabel =
                lineSubtotal !== null ? formatInvoiceCurrency(lineSubtotal, resolvedCurrency) : '—';
              return (
                <View key={`item-${index}`} style={[styles.itemRow, { borderColor }]}> 
                  <View style={styles.itemInfo}>
                    <ThemedText style={styles.itemDescription}>
                      {item.description && item.description.trim() ? item.description : `Ítem ${index + 1}`}
                    </ThemedText>
                    <ThemedText style={[styles.itemMeta, { color: mutedText }]}>{metaLabel}</ThemedText>
                  </View>
                  <ThemedText style={styles.itemSubtotal}>{subtotalLabel}</ThemedText>
                </View>
              );
            })}
          </View>
        ) : (
          <ThemedText style={[styles.emptyItemsText, { color: mutedText }]}>No se registraron ítems en esta factura.</ThemedText>
        )}

        <ThemedText style={[invoiceSharedStyles.sectionHeading, styles.summaryHeading]}>Resumen</ThemedText>
        <View style={[styles.summaryContainer, { borderColor }]}> 
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Subtotal</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {formatInvoiceCurrency(resolvedSubtotal, resolvedCurrency)}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>IVA</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {formatInvoiceCurrency(resolvedVat, resolvedCurrency)}
            </ThemedText>
          </View>
          {resolvedTributes > 0 ? (
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Percepciones</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {formatInvoiceCurrency(resolvedTributes, resolvedCurrency)}
              </ThemedText>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.summaryRowTotal]}>
            <ThemedText style={[styles.summaryLabel, styles.summaryTotalLabel]}>Total</ThemedText>
            <ThemedText style={[styles.summaryValue, styles.summaryTotalValue]}>
              {formatInvoiceCurrency(resolvedTotal, resolvedCurrency)}
            </ThemedText>
          </View>
        </View>

        <View style={[invoiceSharedStyles.sectionDivider, { backgroundColor: borderColor }]} />
        <ThemedText style={invoiceSharedStyles.sectionHeading}>Detalle impositivo</ThemedText>

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
        ) : (
          <ThemedText style={[styles.emptyItemsText, { color: mutedText }]}>
            No se registraron importes de IVA discriminado.
          </ThemedText>
        )}

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
  itemsSection: { marginTop: 4, gap: 10 },
  itemRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemInfo: { flex: 1 },
  itemDescription: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemMeta: { fontSize: 13 },
  itemSubtotal: { fontSize: 14, fontWeight: '600' },
  emptyItemsText: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  summaryHeading: { marginTop: 16 },
  summaryContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  summaryLabel: { fontSize: 14, fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  summaryRowTotal: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 8 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700' },
  summaryTotalValue: { fontSize: 16, fontWeight: '700' },
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
