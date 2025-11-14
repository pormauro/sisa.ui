import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ClientsContext } from '@/contexts/ClientsContext';
import { InvoicesContext, type Invoice } from '@/contexts/InvoicesContext';
import { ReceiptsContext, type Receipt } from '@/contexts/ReceiptsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { formatCurrency } from '@/utils/currency';
import { sortByNewest } from '@/utils/sort';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagada',
};

const normalizeStatus = (status?: string | null): string => {
  if (!status) {
    return 'draft';
  }
  return status.trim().toLowerCase();
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

const getReceiptSortValue = (receipt: Receipt): string | number | null => receipt.receipt_date ?? receipt.id;

const getReceiptAmount = (receipt: Receipt): number => {
  if (typeof receipt.price === 'number' && Number.isFinite(receipt.price)) {
    return receipt.price;
  }
  if (typeof receipt.price === 'string') {
    const parsed = Number(receipt.price.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const getReceiptDate = (receipt: Receipt): string => {
  const date = receipt.receipt_date;
  if (!date) {
    return 'Fecha no disponible';
  }
  const normalized = date.includes('T') ? date : `${date}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString();
};

export default function ClientAccountingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const clientId = Number(id);
  const isValidClientId = Number.isFinite(clientId);

  const router = useRouter();
  const navigation = useNavigation();
  const { clients } = useContext(ClientsContext);
  const { invoices, loadInvoices } = useContext(InvoicesContext);
  const { receipts, loadReceipts } = useContext(ReceiptsContext);
  const { permissions } = useContext(PermissionsContext);

  const canViewInvoices = permissions.includes('listInvoices');
  const canViewReceipts = permissions.includes('listReceipts');
  const client = clients.find(item => item.id === clientId);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#27272A' }, 'background');
  const secondaryText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
  const accentColor = useThemeColor({}, 'tint');
  const receiptAccent = useThemeColor({ light: '#047857', dark: '#10B981' }, 'tint');

  useEffect(() => {
    if (!isValidClientId) {
      Alert.alert('Cliente inválido', 'No pudimos identificar al cliente solicitado.');
      router.back();
      return;
    }
    const title = client?.business_name ? `Contabilidad · ${client.business_name}` : 'Contabilidad';
    const options: Partial<NativeStackNavigationOptions> = { title };
    navigation.setOptions(options);
  }, [client?.business_name, isValidClientId, navigation, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canViewInvoices && !canViewReceipts) {
        Alert.alert('Acceso denegado', 'No tienes permisos para ver la contabilidad de este cliente.');
        router.back();
        return;
      }
      if (canViewInvoices) {
        void loadInvoices();
      }
      if (canViewReceipts) {
        void loadReceipts();
      }
    }, [canViewInvoices, canViewReceipts, loadInvoices, loadReceipts, router])
  );

  const clientInvoices = useMemo(() => {
    if (!canViewInvoices || !isValidClientId) {
      return [] as Invoice[];
    }
    const filtered = invoices.filter(invoice => invoice.client_id === clientId);
    return sortByNewest(filtered, getInvoiceSortValue, invoice => invoice.id);
  }, [canViewInvoices, clientId, invoices, isValidClientId]);

  const clientReceipts = useMemo(() => {
    if (!canViewReceipts || !isValidClientId) {
      return [] as Receipt[];
    }
    const filtered = receipts.filter(
      receipt => receipt.payer_type === 'client' && receipt.payer_client_id === clientId
    );
    return sortByNewest(filtered, getReceiptSortValue, receipt => receipt.id);
  }, [canViewReceipts, clientId, receipts, isValidClientId]);

  const totalInvoicesIssued = useMemo(
    () =>
      clientInvoices.reduce((sum, invoice) => {
        const status = normalizeStatus(invoice.status);
        if (status !== 'issued') {
          return sum;
        }
        return sum + getInvoiceAmount(invoice);
      }, 0),
    [clientInvoices]
  );

  const totalInvoicesDraft = useMemo(
    () =>
      clientInvoices.reduce((sum, invoice) => {
        const status = normalizeStatus(invoice.status);
        if (status !== 'draft') {
          return sum;
        }
        return sum + getInvoiceAmount(invoice);
      }, 0),
    [clientInvoices]
  );

  const totalReceipts = useMemo(
    () => clientReceipts.reduce((sum, receipt) => sum + getReceiptAmount(receipt), 0),
    [clientReceipts]
  );

  const issuedVsReceiptsBalance = totalInvoicesIssued - totalReceipts;
  const formattedIssued = formatCurrency(totalInvoicesIssued);
  const formattedDraft = formatCurrency(totalInvoicesDraft);
  const formattedReceipts = formatCurrency(totalReceipts);
  const formattedBalance = formatCurrency(issuedVsReceiptsBalance);

  const invoicesSection = clientInvoices.length ? (
    clientInvoices.map(invoice => {
      const status = normalizeStatus(invoice.status);
      const invoiceLabel = invoice.invoice_number?.trim() ?? `#${invoice.id}`;
      return (
        <TouchableOpacity
          key={invoice.id}
          style={[styles.card, { backgroundColor: cardBackground, borderColor }]}
          onPress={() => router.push(`/invoices/${invoice.id}`)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Factura {invoiceLabel}</ThemedText>
            <View style={[styles.statusBadge, { borderColor: accentColor }]}>
              <ThemedText style={[styles.statusBadgeText, { color: accentColor }]}>
                {STATUS_LABELS[status] ?? invoice.status}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}> {formatInvoiceDate(invoice)} </ThemedText>
          <ThemedText style={[styles.cardAmount, { color: accentColor }]}> {formatCurrency(getInvoiceAmount(invoice))} </ThemedText>
        </TouchableOpacity>
      );
    })
  ) : (
    <ThemedText style={[styles.emptyText, { color: secondaryText }]}>No hay facturas registradas.</ThemedText>
  );

  const receiptsSection = clientReceipts.length ? (
    clientReceipts.map(receipt => (
      <TouchableOpacity
        key={receipt.id}
        style={[styles.card, { backgroundColor: cardBackground, borderColor }]}
        onPress={() => router.push(`/receipts/${receipt.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.receiptTitleGroup}>
            <Ionicons name="receipt-outline" size={18} color={receiptAccent} style={styles.receiptIcon} />
            <ThemedText style={styles.cardTitle}>Recibo #{receipt.id}</ThemedText>
          </View>
          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}>{getReceiptDate(receipt)}</ThemedText>
        </View>
        {receipt.description ? (
          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]} numberOfLines={2}>
            {receipt.description}
          </ThemedText>
        ) : null}
        <ThemedText style={[styles.cardAmount, { color: receiptAccent }]}>
          {formatCurrency(getReceiptAmount(receipt))}
        </ThemedText>
      </TouchableOpacity>
    ))
  ) : (
    <ThemedText style={[styles.emptyText, { color: secondaryText }]}>No registramos pagos para este cliente.</ThemedText>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Resumen contable</ThemedText>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { borderColor }]}> 
              <ThemedText style={styles.summaryLabel}>Emitidas</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: accentColor }]}>{formattedIssued}</ThemedText>
              <ThemedText style={[styles.summaryMeta, { color: secondaryText }]}>Facturas listas para cobrar</ThemedText>
            </View>
            <View style={[styles.summaryCard, { borderColor }]}> 
              <ThemedText style={styles.summaryLabel}>Borradores</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: secondaryText }]}>{formattedDraft}</ThemedText>
              <ThemedText style={[styles.summaryMeta, { color: secondaryText }]}>Pendientes de emisión</ThemedText>
            </View>
            <View style={[styles.summaryCard, { borderColor }]}> 
              <ThemedText style={styles.summaryLabel}>Pagos recibidos</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: receiptAccent }]}>{formattedReceipts}</ThemedText>
              <ThemedText style={[styles.summaryMeta, { color: secondaryText }]}>Recibos aplicados al cliente</ThemedText>
            </View>
            <View style={[styles.summaryCard, { borderColor }]}> 
              <ThemedText style={styles.summaryLabel}>Saldo emitido</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: accentColor }]}>{formattedBalance}</ThemedText>
              <ThemedText style={[styles.summaryMeta, { color: secondaryText }]}>Emitidas - pagos</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Facturas</ThemedText>
            {canViewInvoices ? (
              <TouchableOpacity
                style={styles.sectionLink}
                onPress={() => router.push('/invoices')}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={16} color={accentColor} />
                <ThemedText style={[styles.sectionLinkText, { color: accentColor }]}>Ir a facturas</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
          {invoicesSection}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Pagos</ThemedText>
            {canViewReceipts ? (
              <TouchableOpacity
                style={styles.sectionLink}
                onPress={() => router.push('/receipts')}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={16} color={receiptAccent} />
                <ThemedText style={[styles.sectionLinkText, { color: receiptAccent }]}>Ir a recibos</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
          {receiptsSection}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLinkText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
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
    minWidth: 150,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  cardAmount: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  receiptTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  receiptIcon: {
    marginRight: 6,
  },
  emptyText: {
    fontSize: 14,
  },
});
