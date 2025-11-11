import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ClientsContext } from '@/contexts/ClientsContext';
import { InvoicesContext, type Invoice } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
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

export default function ClientUnpaidInvoicesScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const clientId = Number(id);
  const isValidClientId = Number.isFinite(clientId);

  const router = useRouter();
  const { invoices, loadInvoices } = useContext(InvoicesContext);
  const { clients } = useContext(ClientsContext);
  const { permissions } = useContext(PermissionsContext);

  const [refreshing, setRefreshing] = useState(false);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#1F2937' }, 'background');
  const secondaryText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
  const accentColor = useThemeColor({}, 'tint');

  const canListInvoices = permissions.includes('listInvoices');

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

  const renderInvoiceItem = useCallback(
    ({ item }: { item: Invoice }) => {
      const status = normalizeStatus(item.status);
      const statusLabel = STATUS_LABELS[status] ?? item.status ?? 'Sin estado';
      const total = typeof item.total_amount === 'number' ? item.total_amount : null;
      const formattedTotal = total !== null && Number.isFinite(total) ? formatCurrency(total) : 'Importe no disponible';
      const dateLabel = formatInvoiceDate(item);
      const subtitleParts = [statusLabel, dateLabel].filter(Boolean);
      const invoiceNumber = item.invoice_number?.trim();

      return (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBackground, borderColor }]}
          onPress={() => handlePressInvoice(item.id)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>
              {invoiceNumber ? `Factura ${invoiceNumber}` : `Factura #${item.id}`}
            </ThemedText>
            <ThemedText style={[styles.cardStatus, { color: accentColor }]}>{statusLabel}</ThemedText>
          </View>
          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}>
            {subtitleParts.join(' · ')}
          </ThemedText>
          <ThemedText style={[styles.cardAmount, { color: accentColor }]}>{formattedTotal}</ThemedText>
        </TouchableOpacity>
      );
    },
    [accentColor, borderColor, cardBackground, handlePressInvoice, secondaryText]
  );

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
        <ThemedText style={styles.headerTitle}>
          {client?.business_name ?? 'Cliente sin nombre'}
        </ThemedText>
        <ThemedText style={[styles.headerSubtitle, { color: secondaryText }]}>Facturas impagas</ThemedText>
      </View>
      <FlatList
        data={unpaidInvoices}
        keyExtractor={item => item.id.toString()}
        renderItem={renderInvoiceItem}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
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
  card: {
    borderRadius: 12,
    borderWidth: 1,
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
  cardStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardSubtitle: {
    marginTop: 8,
    fontSize: 14,
  },
  cardAmount: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
  },
});
