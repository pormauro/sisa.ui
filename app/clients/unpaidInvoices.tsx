import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  GestureResponderEvent,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ClientsContext } from '@/contexts/ClientsContext';
import { InvoicesContext, type Invoice } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';
import { formatCurrency } from '@/utils/currency';
import { sortByNewest } from '@/utils/sort';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
};

const ALLOWED_STATUSES = new Set(['draft', 'issued']);

const getInvoiceSortValue = (invoice: Invoice): string | number | null => {
  if (invoice.invoice_date) {
    return invoice.invoice_date;
  }
  if (invoice.issue_date) {
    return invoice.issue_date;
  }
  if (invoice.created_at) {
    return invoice.created_at;
  }
  if (invoice.updated_at) {
    return invoice.updated_at;
  }
  return invoice.id;
};

const formatInvoiceDate = (invoice: Invoice): string => {
  const candidates = [invoice.invoice_date, invoice.issue_date, invoice.created_at, invoice.updated_at];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const normalized = candidate.includes('T') ? candidate : `${candidate}T00:00:00`;
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
  }
  return 'Fecha no disponible';
};

const normalizeStatus = (status?: string | null): string => {
  if (!status) {
    return 'draft';
  }
  return status.trim().toLowerCase();
};

const getInvoiceAmount = (invoice: Invoice): number => {
  const totalAmount = invoice?.total_amount;
  if (typeof totalAmount === 'number' && Number.isFinite(totalAmount)) {
    return totalAmount;
  }
  if (typeof totalAmount === 'string') {
    const parsed = Number(totalAmount.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const sumInvoicesByStatus = (items: Invoice[], status: string): number =>
  items.reduce((sum, invoice) => {
    const normalized = normalizeStatus(invoice.status);
    if (normalized !== status) {
      return sum;
    }
    return sum + getInvoiceAmount(invoice);
  }, 0);

export default function ClientUnpaidInvoicesScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const clientId = Number(id);
  const isValidClientId = Number.isFinite(clientId);

  const router = useRouter();
  const { invoices, loadInvoices } = useContext(InvoicesContext);
  const { clients } = useContext(ClientsContext);
  const { permissions } = useContext(PermissionsContext);
  const { beginSelection, completeSelection } = usePendingSelection();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#1F2937' }, 'background');
  const secondaryText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
  const accentColor = useThemeColor({}, 'tint');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const secondaryButtonColor = useThemeColor({ light: '#E0F2FE', dark: '#1E3A8A' }, 'background');
  const secondaryButtonText = useThemeColor({ light: '#0369A1', dark: '#BFDBFE' }, 'text');

  const canListInvoices = permissions.includes('listInvoices');
  const canAddReceipt = permissions.includes('addReceipt');
  const canViewReceipts = permissions.includes('listReceipts');
  const canViewAccounting = canListInvoices || canViewReceipts;

  useFocusEffect(
    useCallback(() => {
      if (!canListInvoices) {
        Alert.alert('Acceso denegado', 'No tienes permiso para ver facturas.');
        router.back();
        return;
      }

      void loadInvoices();
    }, [canListInvoices, loadInvoices, router])
  );

  useEffect(() => {
    setSelectedInvoiceIds(new Set());
  }, [clientId]);

  useEffect(() => {
    setSelectedInvoiceIds(prev => {
      if (prev.size === 0) {
        return prev;
      }
      const allowedIds = new Set(unpaidInvoices.map(invoice => invoice.id));
      let changed = false;
      const next = new Set<number>();
      prev.forEach(id => {
        if (allowedIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [unpaidInvoices]);

  const client = useMemo(() => {
    if (!isValidClientId) {
      return undefined;
    }
    return clients.find(item => item.id === clientId);
  }, [clientId, clients, isValidClientId]);

  const unpaidInvoices = useMemo(() => {
    if (!isValidClientId) {
      return [] as Invoice[];
    }

    const filtered = invoices.filter(invoice => {
      if (!invoice || invoice.client_id !== clientId) {
        return false;
      }
      const status = normalizeStatus(invoice.status);
      return ALLOWED_STATUSES.has(status);
    });

    return sortByNewest(filtered, getInvoiceSortValue, invoice => invoice.id);
  }, [clientId, invoices, isValidClientId]);

  const outstandingTotal = useMemo(() => {
    if (!canListInvoices) {
      return 0;
    }

    return unpaidInvoices.reduce((sum, invoice) => sum + getInvoiceAmount(invoice), 0);
  }, [canListInvoices, unpaidInvoices]);

  const formattedOutstandingTotal = useMemo(
    () => formatCurrency(outstandingTotal ?? 0),
    [outstandingTotal],
  );

  const issuedInvoicesTotal = useMemo(
    () => (canListInvoices ? sumInvoicesByStatus(unpaidInvoices, 'issued') : 0),
    [canListInvoices, unpaidInvoices]
  );
  const draftInvoicesTotal = useMemo(
    () => (canListInvoices ? sumInvoicesByStatus(unpaidInvoices, 'draft') : 0),
    [canListInvoices, unpaidInvoices]
  );
  const formattedIssuedTotal = useMemo(() => formatCurrency(issuedInvoicesTotal), [issuedInvoicesTotal]);
  const formattedDraftTotal = useMemo(() => formatCurrency(draftInvoicesTotal), [draftInvoicesTotal]);
  const invoicesGrandTotal = useMemo(
    () => issuedInvoicesTotal + draftInvoicesTotal,
    [draftInvoicesTotal, issuedInvoicesTotal]
  );
  const formattedInvoicesGrandTotal = useMemo(
    () => formatCurrency(invoicesGrandTotal),
    [invoicesGrandTotal]
  );
  const issuedInvoicesCount = useMemo(
    () => unpaidInvoices.filter(invoice => normalizeStatus(invoice.status) === 'issued').length,
    [unpaidInvoices]
  );
  const draftInvoicesCount = useMemo(
    () => unpaidInvoices.filter(invoice => normalizeStatus(invoice.status) === 'draft').length,
    [unpaidInvoices]
  );
  const outstandingInvoicesCount = useMemo(() => unpaidInvoices.length, [unpaidInvoices]);
  const outstandingCountLabel = useMemo(() => {
    const noun = outstandingInvoicesCount === 1 ? 'factura' : 'facturas';
    return `${outstandingInvoicesCount} ${noun}`;
  }, [outstandingInvoicesCount]);
  const selectedInvoices = useMemo(
    () => unpaidInvoices.filter(invoice => selectedInvoiceIds.has(invoice.id)),
    [selectedInvoiceIds, unpaidInvoices]
  );
  const selectedInvoicesTotal = useMemo(
    () => selectedInvoices.reduce((sum, invoice) => sum + getInvoiceAmount(invoice), 0),
    [selectedInvoices]
  );
  const formattedSelectedTotal = useMemo(() => formatCurrency(selectedInvoicesTotal), [selectedInvoicesTotal]);
  const selectedInvoicesCount = selectedInvoices.length;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  }, [loadInvoices]);

  const handlePressInvoice = useCallback(
    (invoiceId: number) => {
      router.push(`/invoices/${invoiceId}`);
    },
    [router]
  );

  const toggleInvoiceSelection = useCallback((invoiceId: number) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  }, []);

  const handleViewInvoiceButton = useCallback(
    (event: GestureResponderEvent, invoiceId: number) => {
      event.stopPropagation();
      handlePressInvoice(invoiceId);
    },
    [handlePressInvoice]
  );

  const clearSelection = useCallback(() => {
    setSelectedInvoiceIds(new Set());
  }, []);

  const renderInvoiceItem = useCallback(
    ({ item }: { item: Invoice }) => {
      const status = normalizeStatus(item.status);
      const statusLabel = STATUS_LABELS[status] ?? item.status ?? 'Sin estado';
      const total = getInvoiceAmount(item);
      const formattedTotal = Number.isFinite(total) ? formatCurrency(total) : 'Importe no disponible';
      const dateLabel = formatInvoiceDate(item);
      const subtitleParts = [statusLabel, dateLabel].filter(Boolean);
      const invoiceNumber = item.invoice_number?.trim();
      const isSelected = selectedInvoiceIds.has(item.id);

      return (
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: cardBackground, borderColor },
            isSelected ? styles.cardSelected : null,
          ]}
          onPress={() => toggleInvoiceSelection(item.id)}
          onLongPress={() => handlePressInvoice(item.id)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name={isSelected ? 'checkbox-outline' : 'square-outline'}
                size={18}
                color={isSelected ? accentColor : secondaryText}
                style={styles.selectionIcon}
              />
              <ThemedText style={styles.cardTitle}>
                {invoiceNumber ? `Factura ${invoiceNumber}` : `Factura #${item.id}`}
              </ThemedText>
            </View>
            <ThemedText style={[styles.cardStatus, { color: accentColor }]}>{statusLabel}</ThemedText>
          </View>
          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}>
            {subtitleParts.join(' · ')}
          </ThemedText>
          <View style={styles.cardFooter}>
            <ThemedText style={[styles.cardAmount, { color: accentColor }]}>{formattedTotal}</ThemedText>
            <TouchableOpacity
              style={styles.cardLink}
              onPress={(event) => handleViewInvoiceButton(event, item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={16} color={accentColor} />
              <ThemedText style={[styles.cardLinkText, { color: accentColor }]}>Ver</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [
      accentColor,
      borderColor,
      cardBackground,
      handlePressInvoice,
      handleViewInvoiceButton,
      secondaryText,
      selectedInvoiceIds,
      toggleInvoiceSelection,
    ]
  );

  const handleCreateReceipt = useCallback(() => {
    if (!canAddReceipt || !isValidClientId) {
      return;
    }

    if (selectedInvoices.length === 0) {
      Alert.alert('Selecciona facturas', 'Marca al menos una factura para generar el recibo.');
      return;
    }

    const descriptionLines = selectedInvoices.map(invoice => {
      const invoiceLabel = invoice.invoice_number?.trim() ?? `#${invoice.id}`;
      const dateLabel = formatInvoiceDate(invoice);
      return `Pago de Comprobante Nro(${invoiceLabel}) - ${dateLabel}`;
    });

    const totalAmount = Number.isFinite(selectedInvoicesTotal) ? selectedInvoicesTotal : 0;
    const pricePayload = totalAmount.toFixed(2);

    beginSelection(SELECTION_KEYS.receipts.payerClient);
    completeSelection(clientId.toString());
    beginSelection(SELECTION_KEYS.receipts.invoicePrefill);
    completeSelection({
      description: descriptionLines.join('\n'),
      price: pricePayload,
    });
    router.push('/receipts/create');
  }, [
    beginSelection,
    canAddReceipt,
    clientId,
    completeSelection,
    isValidClientId,
    router,
    selectedInvoices,
    selectedInvoicesTotal,
  ]);

  const listHeader = useMemo(() => {
    const selectionHint = selectedInvoicesCount > 0;
    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.summaryCardWide, { borderColor }]}>
            <ThemedText style={styles.summaryLabel}>Total facturas</ThemedText>
            <ThemedText style={styles.summaryValue}>{formattedInvoicesGrandTotal}</ThemedText>
            <ThemedText style={[styles.summaryMeta, { color: secondaryText }]}>Emitidas + borradores</ThemedText>
          </View>
          <View style={[styles.summaryCard, { borderColor }]}>
            <ThemedText style={styles.summaryLabel}>Emitidas</ThemedText>
            <ThemedText style={styles.summaryValue}>{formattedIssuedTotal}</ThemedText>
            <ThemedText style={[styles.summaryMeta, { color: secondaryText }]}>
              {issuedInvoicesCount} {issuedInvoicesCount === 1 ? 'comprobante' : 'comprobantes'}
            </ThemedText>
          </View>
          <View style={[styles.summaryCard, { borderColor }]}> 
            <ThemedText style={styles.summaryLabel}>Borradores</ThemedText>
            <ThemedText style={styles.summaryValue}>{formattedDraftTotal}</ThemedText>
            <ThemedText style={[styles.summaryMeta, { color: secondaryText }]}>
              {draftInvoicesCount} {draftInvoicesCount === 1 ? 'borrador' : 'borradores'}
            </ThemedText>
          </View>
          {selectionHint ? (
            <View style={[styles.summaryCard, styles.selectionCard, { borderColor: accentColor }]}> 
              <ThemedText style={styles.summaryLabel}>Seleccionadas</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: accentColor }]}>
                {formattedSelectedTotal}
              </ThemedText>
              <ThemedText style={[styles.summaryMeta, { color: secondaryText }]}>
                {selectedInvoicesCount} {selectedInvoicesCount === 1 ? 'factura' : 'facturas'}
              </ThemedText>
            </View>
          ) : null}
        </View>
        {selectionHint ? (
          <View style={[styles.selectionSummary, { borderColor }]}> 
            <View>
              <ThemedText style={styles.selectionSummaryTitle}>Importe a cobrar</ThemedText>
              <ThemedText style={[styles.selectionSummaryValue, { color: accentColor }]}>
                {formattedSelectedTotal}
              </ThemedText>
            </View>
            <TouchableOpacity style={styles.clearSelectionButton} onPress={clearSelection}>
              <Ionicons name="close-circle" size={18} color={secondaryText} />
              <ThemedText style={[styles.clearSelectionText, { color: secondaryText }]}>Limpiar</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }, [
    accentColor,
    borderColor,
    clearSelection,
    draftInvoicesCount,
    formattedDraftTotal,
    formattedInvoicesGrandTotal,
    formattedIssuedTotal,
    formattedSelectedTotal,
    issuedInvoicesCount,
    secondaryText,
    selectedInvoicesCount,
  ]);

  if (!isValidClientId) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background }]}>
        <ThemedText style={styles.emptyText}>Cliente inválido</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Facturas impagas</ThemedText>
        <View style={styles.headerActions}>
          {canViewAccounting ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: secondaryButtonColor }]}
              onPress={() => router.push(`/clients/accounting?id=${clientId}`)}
              activeOpacity={0.85}
            >
              <Ionicons
                name="file-tray-stacked-outline"
                size={18}
                color={secondaryButtonText}
                style={styles.receiptButtonIcon}
              />
              <ThemedText style={[styles.receiptButtonText, { color: secondaryButtonText }]}>Contabilidad</ThemedText>
            </TouchableOpacity>
          ) : null}
          {canAddReceipt ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: buttonColor }]}
              onPress={handleCreateReceipt}
              activeOpacity={0.85}
            >
              <Ionicons
                name="receipt-outline"
                size={18}
                color={buttonTextColor}
                style={styles.receiptButtonIcon}
              />
              <ThemedText style={[styles.receiptButtonText, { color: buttonTextColor }]}>Crear recibo</ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.headerInfo}>
          <ThemedText style={styles.headerClientName}>
            {client?.business_name ?? 'Cliente sin nombre'}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: secondaryText }]}>Facturas impagas</ThemedText>
          {canListInvoices ? (
            <>
              <ThemedText style={[styles.headerTotal, { color: accentColor }]}>
                Total adeudado: {formattedOutstandingTotal}
              </ThemedText>
              <ThemedText style={[styles.headerCount, { color: secondaryText }]}>
                Cantidad adeudada: {outstandingCountLabel}
              </ThemedText>
            </>
          ) : null}
        </View>
      </View>
      <FlatList
        data={unpaidInvoices}
        keyExtractor={item => item.id.toString()}
        renderItem={renderInvoiceItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            {canListInvoices
              ? 'No hay facturas emitidas o borrador para este cliente.'
              : 'No tienes permiso para ver las facturas.'}
          </ThemedText>
        }
        contentContainerStyle={unpaidInvoices.length === 0 ? styles.emptyListContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerInfo: {
    marginTop: 12,
    gap: 4,
  },
  headerClientName: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    alignSelf: 'flex-start',
    textAlign: 'left',
  },
  headerTotal: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    alignSelf: 'flex-start',
  },
  headerCount: {
    fontSize: 14,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 12,
    marginBottom: 8,
  },
  receiptButtonIcon: {
    marginRight: 6,
  },
  receiptButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardSelected: {
    borderWidth: 2,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectionIcon: {
    marginRight: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  cardStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardSubtitle: {
    marginTop: 8,
    fontSize: 14,
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLinkText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    margin: 4,
    flexGrow: 1,
    minWidth: 140,
  },
  summaryCardWide: {
    width: '100%',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  summaryMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  selectionCard: {
    borderStyle: 'dashed',
  },
  selectionSummary: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionSummaryTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectionSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  clearSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearSelectionText: {
    marginLeft: 4,
    fontSize: 14,
  },
});
