import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { InvoicesContext, type Invoice } from '@/contexts/InvoicesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { JobsContext } from '@/contexts/JobsContext';
import { TariffsContext, type Tariff } from '@/contexts/TariffsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/utils/currency';
import { calculateJobTotal, parseJobIdsParam } from '@/utils/jobTotals';
import { DaySeparator } from '@/components/DaySeparator';
import { withDaySeparators, type DaySeparatedItem } from '@/utils/daySeparators';

type InvoiceListItem = Invoice & {
  formattedTotal: string;
  formattedIssueDate: string;
  statusLabel: string;
  statusColor: string;
  conceptsLabel: string;
  clientName: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagado',
  canceled: 'Cancelado',
  void: 'Cancelado',
};

const resolveStatusColor = (status: string, tintColor: string): string => {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'issued':
      return '#0a84ff';
    case 'paid':
      return '#34c759';
    case 'canceled':
    case 'void':
      return '#ff3b30';
    case 'draft':
    default:
      return tintColor;
  }
};

const formatDate = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

export default function InvoicesScreen() {
  const params = useLocalSearchParams<{ jobIds?: string | string[] }>();
  const router = useRouter();
  const { invoices, loadInvoices } = useContext(InvoicesContext);
  const { permissions } = useContext(PermissionsContext);
  const { jobs, loadJobs } = useContext(JobsContext);
  const { tariffs } = useContext(TariffsContext);
  const { clients } = useContext(ClientsContext);

  const [refreshing, setRefreshing] = useState(false);
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#1F1F1F' }, 'background');
  const borderColor = useThemeColor({ light: '#E0E0E0', dark: '#333333' }, 'background');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#BBBBBB' }, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const bannerBackground = useThemeColor({ light: '#F0F9FF', dark: '#0F172A' }, 'background');
  const bannerBorder = useThemeColor({ light: '#BAE6FD', dark: '#1E293B' }, 'background');

  const canList = permissions.includes('listInvoices');
  const canCreate = permissions.includes('addInvoice');
  const canUpdate = permissions.includes('updateInvoice');
  const clientNameById = useMemo(() => {
    const map = new Map<number, string>();
    clients.forEach(client => {
      map.set(client.id, client.business_name);
    });
    return map;
  }, [clients]);

  const selectedJobIds = useMemo(() => new Set(parseJobIdsParam(params.jobIds)), [params.jobIds]);

  const tariffAmountById = useMemo(() => {
    const amountById = new Map<number, number>();
    tariffs.forEach((tariff: Tariff) => {
      amountById.set(tariff.id, tariff.amount);
    });
    return amountById;
  }, [tariffs]);

  const selectedJobs = useMemo(() => {
    if (selectedJobIds.size === 0) {
      return [];
    }
    return jobs.filter(job => selectedJobIds.has(job.id));
  }, [jobs, selectedJobIds]);

  const selectedJobsTotal = useMemo(() => {
    if (selectedJobs.length === 0) {
      return 0;
    }
    return selectedJobs.reduce((total, job) => {
      const jobTotal = calculateJobTotal(job, tariffAmountById);
      if (!Number.isFinite(jobTotal) || jobTotal <= 0) {
        return total;
      }
      return total + jobTotal;
    }, 0);
  }, [selectedJobs, tariffAmountById]);

  const formattedSelectedJobsTotal = useMemo(
    () => formatCurrency(selectedJobsTotal),
    [selectedJobsTotal],
  );

  const selectedJobsCount = selectedJobs.length;

  const formattedJobIdsParam = useMemo(() => {
    if (selectedJobIds.size === 0) {
      return '';
    }
    return Array.from(selectedJobIds.values())
      .map(id => id.toString())
      .join(',');
  }, [selectedJobIds]);

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver facturas.');
      router.back();
    }
  }, [canList, router]);

  useEffect(() => {
    if (selectedJobIds.size > 0) {
      void loadJobs();
    }
  }, [loadJobs, selectedJobIds.size]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      void loadInvoices();
    }, [canList, loadInvoices]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  }, [loadInvoices]);

  const enrichedInvoices = useMemo<InvoiceListItem[]>(() => {
    return invoices.map(invoice => {
      const total = typeof invoice.total_amount === 'number' ? invoice.total_amount : null;
      const formattedTotal =
        total !== null && Number.isFinite(total) ? formatCurrency(total) : 'Importe no disponible';
      const normalizedStatus = invoice.status ? invoice.status.toLowerCase() : 'draft';
      const statusLabel = STATUS_LABELS[normalizedStatus] ?? invoice.status ?? 'Sin estado';
      const statusColor = resolveStatusColor(normalizedStatus, tintColor);
      const itemsCount = Array.isArray(invoice.items) ? invoice.items.length : 0;
      const conceptsLabel = itemsCount > 0 ? `${itemsCount} ítem${itemsCount === 1 ? '' : 's'}` : 'Sin ítems';
      const clientName =
        typeof invoice.client_id === 'number'
          ? clientNameById.get(invoice.client_id) ?? 'Cliente sin nombre'
          : 'Cliente sin asignar';
      return {
        ...invoice,
        formattedTotal,
        formattedIssueDate: formatDate(invoice.invoice_date ?? invoice.issue_date ?? invoice.created_at ?? null),
        statusLabel,
        statusColor,
        conceptsLabel,
        clientName,
      };
    });
  }, [clientNameById, invoices, tintColor]);

  const invoicesWithSeparators = useMemo(
    () =>
      withDaySeparators(
        enrichedInvoices,
        invoice => invoice.invoice_date ?? invoice.issue_date ?? invoice.created_at ?? null,
      ),
    [enrichedInvoices],
  );

  const handleCreate = useCallback(() => {
    if (!canCreate) {
      return;
    }
    if (formattedJobIdsParam) {
      router.push({ pathname: '/invoices/create', params: { jobIds: formattedJobIdsParam } });
      return;
    }
    router.push('/invoices/create');
  }, [canCreate, formattedJobIdsParam, router]);

  const handleEdit = useCallback(
    (invoice: Invoice) => {
      if (!canUpdate) {
        return;
      }
      if (formattedJobIdsParam) {
        router.push({
          pathname: '/invoices/[id]',
          params: { id: invoice.id.toString(), jobIds: formattedJobIdsParam },
        });
        return;
      }
      router.push({ pathname: '/invoices/[id]', params: { id: invoice.id.toString() } });
    },
    [canUpdate, formattedJobIdsParam, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: DaySeparatedItem<InvoiceListItem> }) => {
      if (item.type === 'separator') {
        return <DaySeparator label={item.label} />;
      }

      const invoice = item.value;
      const hasPdf = Boolean(invoice.invoice_pdf_file_id);
      return (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBackground, borderColor }]}
          onPress={() => handleEdit(invoice)}
          disabled={!canUpdate}
        >
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleContainer}>
              <ThemedText style={styles.invoiceNumber} numberOfLines={1}>
                {invoice.clientName}
              </ThemedText>
              <ThemedText style={[styles.clientName, { color: secondaryText }]} numberOfLines={1}>
                {`Factura Número ${invoice.invoice_number ?? invoice.id} · ${invoice.formattedTotal}`}
              </ThemedText>
            </View>
            <View style={styles.headerActions}>
              <View style={[styles.statusPill, { borderColor: invoice.statusColor }]}>
                <ThemedText style={[styles.statusText, { color: invoice.statusColor }]}>
                  {invoice.statusLabel}
                </ThemedText>
              </View>
              <Ionicons
                name={hasPdf ? 'document-text' : 'document-text-outline'}
                size={18}
                color={hasPdf ? tintColor : secondaryText}
              />
            </View>
          </View>

          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}>Fecha</ThemedText>
          <ThemedText style={styles.cardValue}>{invoice.formattedIssueDate}</ThemedText>

          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}>Importe</ThemedText>
          <ThemedText style={styles.cardValue}>{invoice.formattedTotal}</ThemedText>

          <ThemedText style={[styles.cardSubtitle, { color: secondaryText }]}>Conceptos</ThemedText>
          <ThemedText style={styles.cardValue}>{invoice.conceptsLabel}</ThemedText>
        </TouchableOpacity>
      );
    },
    [borderColor, cardBackground, canUpdate, handleEdit, secondaryText, tintColor],
  );

  const listEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <ThemedText style={styles.emptyTitle}>No hay facturas registradas todavía</ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        Las facturas emitidas, en borrador o anuladas aparecerán en este listado.
      </ThemedText>
    </View>
  ), []);

  const listHeaderComponent = useMemo(() => {
    if (selectedJobsCount === 0) {
      return null;
    }

    return (
      <View
        style={[
          styles.selectionBanner,
          { backgroundColor: bannerBackground, borderColor: bannerBorder },
        ]}
      >
        <ThemedText style={styles.selectionBannerTitle}>
          Trabajos seleccionados: {selectedJobsCount}
        </ThemedText>
        <ThemedText style={styles.selectionBannerBody}>
          Total estimado a facturar: {formattedSelectedJobsTotal}
        </ThemedText>
        <ThemedText style={styles.selectionBannerNote}>
          Abrí una factura existente para vincular los trabajos o creá una nueva con los importes sugeridos.
        </ThemedText>
      </View>
    );
  }, [bannerBackground, bannerBorder, formattedSelectedJobsTotal, selectedJobsCount]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <FlatList
        data={invoicesWithSeparators}
        keyExtractor={item =>
          item.type === 'separator' ? `separator-${item.id}` : item.value.id.toString()
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={listEmptyComponent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />

      {canCreate && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: buttonColor }]} onPress={handleCreate}>
          <Ionicons name="add" size={28} color={buttonTextColor} />
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 96,
  },
  selectionBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  selectionBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectionBannerBody: {
    fontSize: 14,
    marginBottom: 8,
  },
  selectionBannerNote: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invoiceNumber: {
    fontSize: 18,
    fontWeight: '600',
  },
  clientName: {
    fontSize: 14,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 120,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 39,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
