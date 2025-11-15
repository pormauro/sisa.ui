import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ExpoCheckbox from 'expo-checkbox';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext, Tariff } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { isStatusFinalized } from '@/hooks/useClientFinalizedJobTotals';
import { sortByNewest } from '@/utils/sort';
import { formatCurrency } from '@/utils/currency';
import { formatTimeInterval } from '@/utils/time';
import {
  calculateJobTotal,
  calculateJobsTotal,
  formatJobIdsParam,
} from '@/utils/jobTotals';
import { buildFacturadoStatusIdSet, isStatusFacturado } from '@/utils/statuses';

type Params = {
  id?: string;
};

const FINALIZED_STATUS_ID = 6;

const getStatusById = (statuses: Status[]) => {
  const map = new Map<number, Status>();
  statuses.forEach(status => {
    map.set(status.id, status);
  });
  return map;
};

const extractDate = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.includes(' ') ? value.split(' ')[0] ?? '' : value;
};

const extractTime = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const [, timePart] = trimmed.split(' ');
  const candidate = timePart ?? trimmed;
  const [hours = '', minutes = ''] = candidate.split(':');
  if (!hours) {
    return '';
  }
  return minutes ? `${hours}:${minutes}` : hours;
};

const getJobSortValue = (job: Job): string | number | null | undefined => {
  if (job.updated_at) {
    return job.updated_at;
  }
  if (job.created_at) {
    return job.created_at;
  }
  if (job.job_date) {
    return `${job.job_date}T${job.start_time ?? '00:00:00'}`;
  }
  return job.id;
};

export default function ClientFinalizedJobsScreen() {
  const { id } = useLocalSearchParams<Params>();
  const clientId = Number(id);
  const isValidClientId = Number.isFinite(clientId);

  const router = useRouter();
  const { jobs, loadJobs } = useContext(JobsContext);
  const { statuses } = useContext(StatusesContext);
  const { clients } = useContext(ClientsContext);
  const { tariffs } = useContext(TariffsContext);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const accentColor = useThemeColor({}, 'tint');
  const selectionAccent = useThemeColor({}, 'button');
  const selectionTextColor = useThemeColor({}, 'buttonText');
  const metricLabelColor = useThemeColor({ light: '#4b5563', dark: '#d1d5db' }, 'text');

  const canListJobs = permissions.includes('listJobs');
  const { refreshing, handleRefresh } = usePullToRefresh(loadJobs, canListJobs);

  useFocusEffect(
    useCallback(() => {
      if (!canListJobs) {
        Alert.alert('Acceso denegado', 'No tienes permiso para ver los trabajos de este cliente.');
        router.back();
        return;
      }

      void loadJobs();
    }, [canListJobs, loadJobs, router])
  );

  const statusById = useMemo(() => getStatusById(statuses), [statuses]);
  const facturadoStatusIds = useMemo(
    () => buildFacturadoStatusIdSet(statuses),
    [statuses],
  );

  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());
  const [showPendingJobs, setShowPendingJobs] = useState(true);

  const client = useMemo(() => {
    if (!isValidClientId) {
      return undefined;
    }
    return clients.find(item => item.id === clientId);
  }, [clients, clientId, isValidClientId]);

  const clientJobs = useMemo(() => {
    if (!isValidClientId) {
      return [] as Job[];
    }

    const filtered = jobs.filter(job => job && job.client_id === clientId);
    return sortByNewest(filtered, getJobSortValue, job => job.id);
  }, [clientId, isValidClientId, jobs]);

  const finalizedJobs = useMemo(() => {
    if (!isValidClientId) {
      return [] as Job[];
    }

    const filtered = clientJobs.filter(job => {
      if (!job || job.client_id !== clientId) {
        return false;
      }
      const status = job.status_id != null ? statusById.get(job.status_id) : undefined;
      if (
        (job.status_id != null && facturadoStatusIds.has(job.status_id)) ||
        isStatusFacturado(status)
      ) {
        return false;
      }
      if (job.status_id === FINALIZED_STATUS_ID) {
        return true;
      }
      return isStatusFinalized(status);
    });

    return sortByNewest(filtered, getJobSortValue, job => job.id);
  }, [clientId, clientJobs, facturadoStatusIds, isValidClientId, statusById]);

  const nonFinalizedJobs = useMemo(() => {
    if (!isValidClientId) {
      return [] as Job[];
    }

    return clientJobs.filter(job => {
      if (!job || job.client_id !== clientId) {
        return false;
      }
      const status = job.status_id != null ? statusById.get(job.status_id) : undefined;
      if (
        (job.status_id != null && facturadoStatusIds.has(job.status_id)) ||
        isStatusFacturado(status)
      ) {
        return false;
      }
      return !isStatusFinalized(status) && job.status_id !== FINALIZED_STATUS_ID;
    });
  }, [clientId, clientJobs, facturadoStatusIds, isValidClientId, statusById]);

  const allFinalizedJobIds = useMemo(
    () => finalizedJobs.map(job => job.id),
    [finalizedJobs]
  );

  const finalizedJobIdsSet = useMemo(() => new Set(allFinalizedJobIds), [allFinalizedJobIds]);

  const jobsToDisplay = useMemo(() => {
    if (!showPendingJobs) {
      return finalizedJobs;
    }

    return [...finalizedJobs, ...nonFinalizedJobs];
  }, [finalizedJobs, nonFinalizedJobs, showPendingJobs]);

  useEffect(() => {
    setSelectedJobIds(prev => {
      if (prev.size === 0) {
        return prev;
      }
      const validIds = new Set(allFinalizedJobIds);
      const next = new Set<number>();
      prev.forEach(id => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [allFinalizedJobIds]);

  const toggleJobSelection = useCallback((jobId: number) => {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  const selectAllJobs = useCallback(() => {
    setSelectedJobIds(new Set(allFinalizedJobIds));
  }, [allFinalizedJobIds]);

  const clearSelectedJobs = useCallback(() => {
    setSelectedJobIds(new Set());
  }, []);

  const selectedCount = selectedJobIds.size;

  const tariffAmountById = useMemo(() => {
    const amountById = new Map<number, number>();
    tariffs.forEach((tariff: Tariff) => {
      amountById.set(tariff.id, tariff.amount);
    });
    return amountById;
  }, [tariffs]);

  const selectedJobIdsList = useMemo(() => Array.from(selectedJobIds.values()), [selectedJobIds]);

  const selectedTotal = useMemo(
    () => calculateJobsTotal(finalizedJobs, selectedJobIds, tariffAmountById),
    [finalizedJobs, selectedJobIds, tariffAmountById],
  );

  const jobIdsParam = useMemo(() => formatJobIdsParam(selectedJobIdsList), [selectedJobIdsList]);
  const clientIdParam = useMemo(
    () => (isValidClientId ? clientId.toString() : undefined),
    [clientId, isValidClientId],
  );

  const showInvoiceActions =
    selectedCount > 0 &&
    Boolean(clientIdParam) &&
    permissions.includes('listInvoices') &&
    permissions.includes('addInvoice');

  const handleCreateInvoice = useCallback(() => {
    if (!showInvoiceActions || !jobIdsParam) {
      return;
    }

    router.push({
      pathname: '/invoices/create',
      params: { jobIds: jobIdsParam, clientId: clientIdParam as string },
    });
  }, [clientIdParam, jobIdsParam, router, showInvoiceActions]);

  const renderItem = ({ item }: { item: Job }) => {
    const status = item.status_id != null ? statusById.get(item.status_id) : undefined;
    const date = extractDate(item.job_date);
    const start = extractTime(item.start_time);
    const end = extractTime(item.end_time);
    const interval = formatTimeInterval(start, end);
    const isFinalizedJob = finalizedJobIdsSet.has(item.id);
    const isSelected = isFinalizedJob && selectedJobIds.has(item.id);
    const jobTotal = calculateJobTotal(item, tariffAmountById);
    const formattedJobTotal =
      Number.isFinite(jobTotal) && jobTotal > 0 ? formatCurrency(jobTotal) : '—';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: cardBackground, borderColor },
          isSelected ? { borderColor: selectionAccent, borderWidth: 2 } : null,
          !isFinalizedJob ? styles.cardDisabled : null,
        ]}
        onPress={() => {
          if (!isFinalizedJob) {
            return;
          }
          toggleJobSelection(item.id);
        }}
        onLongPress={() => router.push(`/jobs/viewModal?id=${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <ExpoCheckbox
            value={isSelected}
            onValueChange={() => {
              if (!isFinalizedJob) {
                return;
              }
              toggleJobSelection(item.id);
            }}
            color={isSelected ? selectionAccent : undefined}
            style={styles.checkbox}
            disabled={!isFinalizedJob}
          />
          <ThemedText style={[styles.cardTitle, { color: textColor }]}>{item.description || 'Trabajo sin descripción'}</ThemedText>
          {status ? (
            <View style={[styles.statusTag, { borderColor: accentColor }]}>
              <ThemedText style={[styles.statusTagText, { color: accentColor }]}>
                {status.label || 'Estado sin nombre'}
              </ThemedText>
            </View>
          ) : null}
        </View>
        {item.type_of_work ? (
          <ThemedText style={[styles.cardSubtitle, { color: textColor }]}>
            {item.type_of_work}
          </ThemedText>
        ) : null}
        {(date || start || end) && (
          <ThemedText style={[styles.cardMeta, { color: textColor }]}>
            {date}
            {start || end ? ` · ${start}${end ? ` - ${end}` : ''}` : ''}
            {interval ? ` (${interval})` : ''}
          </ThemedText>
        )}
        <ThemedText style={[styles.cardAmount, { color: accentColor }]}>
          Costo: {formattedJobTotal}
        </ThemedText>
        <TouchableOpacity
          style={styles.detailButton}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            router.push(`/jobs/viewModal?id=${item.id}`);
          }}
        >
          <ThemedText style={[styles.detailButtonText, { color: accentColor }]}>Ver detalle</ThemedText>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

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
        <ThemedText style={styles.headerCount}>
          {finalizedJobs.length === 1
            ? '1 trabajo finalizado'
            : `${finalizedJobs.length} trabajos finalizados`}
          {nonFinalizedJobs.length > 0
            ? ` · ${
                nonFinalizedJobs.length === 1
                  ? '1 trabajo pendiente'
                  : `${nonFinalizedJobs.length} trabajos pendientes`
              }`
            : ''}
        </ThemedText>
      </View>
      {nonFinalizedJobs.length > 0 ? (
        <TouchableOpacity
          style={[styles.pendingToggleButton, { borderColor: accentColor }]}
          onPress={() => setShowPendingJobs(value => !value)}
        >
          <Ionicons
            name={showPendingJobs ? 'eye-off-outline' : 'eye-outline'}
            size={16}
            color={accentColor}
            style={styles.pendingToggleIcon}
          />
          <ThemedText style={[styles.pendingToggleText, { color: accentColor }]}> 
            {showPendingJobs ? 'Ocultar trabajos pendientes' : 'Mostrar trabajos pendientes'}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
      {finalizedJobs.length > 0 ? (
        <View
          style={[styles.selectionBar, { borderColor, backgroundColor: cardBackground }]}
        >
          <ThemedText style={styles.selectionSummary}>
            {selectedCount === 1
              ? '1 trabajo seleccionado'
              : `${selectedCount} trabajos seleccionados`}
          </ThemedText>
          <View style={styles.selectionActions}>
            <TouchableOpacity
              style={[styles.selectionButton, { borderColor: accentColor }]}
              onPress={selectAllJobs}
            >
              <Ionicons name="checkbox-outline" size={18} color={accentColor} style={styles.selectionButtonIcon} />
              <ThemedText style={[styles.selectionButtonText, { color: accentColor }]}>Todo</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectionButton, styles.selectionButtonSpacing, { borderColor: accentColor }]}
              onPress={clearSelectedJobs}
            >
              <Ionicons name="remove-circle-outline" size={18} color={accentColor} style={styles.selectionButtonIcon} />
              <ThemedText style={[styles.selectionButtonText, { color: accentColor }]}>Ninguno</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {showInvoiceActions ? (
        <View style={[styles.invoiceActionsContainer, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={styles.invoiceActionsTitle}>Acciones con trabajos seleccionados</ThemedText>
          <View style={styles.invoiceActionsButtons}>
            <TouchableOpacity
              style={[styles.invoiceActionButton, { backgroundColor: selectionAccent }]}
              onPress={handleCreateInvoice}
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={selectionTextColor}
                style={styles.invoiceActionIcon}
              />
              <ThemedText style={[styles.invoiceActionText, { color: selectionTextColor }]}>
                Crear factura
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      <FlatList
        data={jobsToDisplay}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        extraData={[Array.from(selectedJobIds), showPendingJobs]}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            No hay trabajos para mostrar con la configuración actual
          </ThemedText>
        }
        ListFooterComponent={
          finalizedJobs.length > 0 ? (
            <View
              style={[
                styles.footer,
                { borderColor, borderTopColor: borderColor, backgroundColor: cardBackground },
              ]}
            >
              <ThemedText style={styles.footerTotal}>
                Total seleccionado: {formatCurrency(selectedTotal)}
              </ThemedText>
              <ThemedText style={[styles.footerNote, { color: metricLabelColor }]}>
                Selecciona trabajos para consultar el total y usá las acciones para iniciar la facturación.
              </ThemedText>
            </View>
          ) : null
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
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
    fontWeight: '700',
    marginBottom: 4,
  },
  headerCount: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardDisabled: {
    opacity: 0.65,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checkbox: {
    marginRight: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
  },
  cardAmount: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
  statusTag: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionBar: {
    marginBottom: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  selectionSummary: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0,
    minWidth: 120,
  },
  selectionButtonSpacing: {
    marginLeft: 12,
  },
  selectionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectionButtonIcon: {
    marginRight: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  footer: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 16,
    alignItems: 'center',
  },
  footerTotal: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  invoiceActionsContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  invoiceActionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  invoiceActionsButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  invoiceActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
  },
  invoiceActionIcon: {
    marginRight: 8,
  },
  invoiceActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pendingToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 999,
    marginBottom: 12,
  },
  pendingToggleIcon: {
    marginRight: 6,
  },
  pendingToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

