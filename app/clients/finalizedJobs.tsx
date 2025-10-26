import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import ExpoCheckbox from 'expo-checkbox';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { TariffsContext, Tariff } from '@/contexts/TariffsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { isStatusFinalized } from '@/hooks/useClientFinalizedJobTotals';
import { sortByNewest } from '@/utils/sort';
import { formatCurrency } from '@/utils/currency';
import { formatTimeInterval } from '@/utils/time';

type Params = {
  id?: string;
};

const FINALIZED_STATUS_ID = 6;

const normalizeTimeValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  let trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const separators = [' ', 'T'];
  separators.forEach(separator => {
    if (trimmed.includes(separator)) {
      const parts = trimmed.split(separator);
      trimmed = parts[parts.length - 1] ?? trimmed;
    }
  });

  trimmed = trimmed.replace(/[zZ]$/, '');
  const timezoneIndex = trimmed.search(/[+-]/);
  if (timezoneIndex > 0) {
    trimmed = trimmed.slice(0, timezoneIndex);
  }

  const timeSegments = trimmed.split(':').filter(Boolean);
  if (timeSegments.length === 0) {
    return null;
  }

  const [hours = '00', minutes = '00', secondsWithFraction = '00'] = timeSegments;
  const [seconds = '00'] = secondsWithFraction.split('.');
  const normalizedHours = hours.padStart(2, '0');
  const normalizedMinutes = minutes.padStart(2, '0');
  const normalizedSeconds = seconds.padStart(2, '0');

  return `${normalizedHours}:${normalizedMinutes}:${normalizedSeconds}`;
};

const getJobDurationHours = (job: Job): number => {
  const start = normalizeTimeValue(job.start_time);
  const end = normalizeTimeValue(job.end_time);

  if (!start || !end) {
    return 0;
  }

  const startDate = new Date(`1970-01-01T${start}`);
  const endDate = new Date(`1970-01-01T${end}`);

  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return 0;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return diffMs / (1000 * 60 * 60);
};

const getJobHourlyRate = (job: Job, tariffAmountById: Map<number, number>): number => {
  const manualAmount = job.manual_amount;
  if (typeof manualAmount === 'number' && Number.isFinite(manualAmount)) {
    return manualAmount;
  }

  if (typeof manualAmount === 'string') {
    const parsedManual = Number(manualAmount.trim());
    if (Number.isFinite(parsedManual)) {
      return parsedManual;
    }
  }

  if (job.tariff_id != null) {
    const tariffAmount = tariffAmountById.get(job.tariff_id);
    if (typeof tariffAmount === 'number' && Number.isFinite(tariffAmount)) {
      return tariffAmount;
    }
  }

  return 0;
};

const calculateJobTotal = (job: Job, tariffAmountById: Map<number, number>): number => {
  const durationHours = getJobDurationHours(job);
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return 0;
  }

  const hourlyRate = getJobHourlyRate(job, tariffAmountById);
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return 0;
  }

  return durationHours * hourlyRate;
};

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
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const canListJobs = permissions.includes('listJobs');

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

  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());

  const client = useMemo(() => {
    if (!isValidClientId) {
      return undefined;
    }
    return clients.find(item => item.id === clientId);
  }, [clients, clientId, isValidClientId]);

  const finalizedJobs = useMemo(() => {
    if (!isValidClientId) {
      return [] as Job[];
    }

    const filtered = jobs.filter(job => {
      if (!job || job.client_id !== clientId) {
        return false;
      }
      const status = job.status_id != null ? statusById.get(job.status_id) : undefined;
      if (job.status_id === FINALIZED_STATUS_ID) {
        return true;
      }
      return isStatusFinalized(status);
    });

    return sortByNewest(filtered, getJobSortValue, job => job.id);
  }, [clientId, isValidClientId, jobs, statusById]);

  const allFinalizedJobIds = useMemo(
    () => finalizedJobs.map(job => job.id),
    [finalizedJobs]
  );

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

  const selectedTotal = useMemo(() => {
    if (selectedJobIds.size === 0) {
      return 0;
    }

    const tariffAmountById = new Map<number, number>();
    tariffs.forEach((tariff: Tariff) => {
      tariffAmountById.set(tariff.id, tariff.amount);
    });

    return finalizedJobs.reduce((total, job) => {
      if (!selectedJobIds.has(job.id)) {
        return total;
      }

      const jobTotal = calculateJobTotal(job, tariffAmountById);
      if (!Number.isFinite(jobTotal) || jobTotal <= 0) {
        return total;
      }

      return total + jobTotal;
    }, 0);
  }, [finalizedJobs, selectedJobIds, tariffs]);

  const handleGenerateInvoice = useCallback(() => {
    if (selectedCount === 0) {
      Alert.alert('Selecciona trabajos', 'Selecciona al menos un trabajo para continuar.');
      return;
    }

    Alert.alert(
      'Próximamente',
      'La generación de facturas a partir de trabajos seleccionados estará disponible en una próxima versión.'
    );
  }, [selectedCount]);

  const isGenerateDisabled = selectedCount === 0;

  const renderItem = ({ item }: { item: Job }) => {
    const status = item.status_id != null ? statusById.get(item.status_id) : undefined;
    const date = extractDate(item.job_date);
    const start = extractTime(item.start_time);
    const end = extractTime(item.end_time);
    const interval = formatTimeInterval(start, end);
    const isSelected = selectedJobIds.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: cardBackground, borderColor },
          isSelected ? { borderColor: selectionAccent, borderWidth: 2 } : null,
        ]}
        onPress={() => toggleJobSelection(item.id)}
        onLongPress={() => router.push(`/jobs/viewModal?id=${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <ExpoCheckbox
            value={isSelected}
            onValueChange={() => toggleJobSelection(item.id)}
            color={isSelected ? selectionAccent : undefined}
            style={styles.checkbox}
          />
          <ThemedText style={[styles.cardTitle, { color: textColor }]}>{item.description || 'Trabajo sin descripción'}</ThemedText>
          {status ? (
            <View style={[styles.statusTag, { borderColor: accentColor }]}>
              <ThemedText style={[styles.statusTagText, { color: accentColor }]}>
                {status.label || status.value}
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
        <ThemedText style={styles.headerSubtitle}>Trabajos finalizados</ThemedText>
        <ThemedText style={styles.headerCount}>
          {finalizedJobs.length === 1
            ? '1 trabajo encontrado'
            : `${finalizedJobs.length} trabajos encontrados`}
        </ThemedText>
      </View>
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
              <ThemedText style={[styles.selectionButtonText, { color: accentColor }]}>Seleccionar todos</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectionButton, styles.selectionButtonSpacing, { borderColor: accentColor }]}
              onPress={clearSelectedJobs}
            >
              <ThemedText style={[styles.selectionButtonText, { color: accentColor }]}>Des-seleccionar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      <FlatList
        data={finalizedJobs}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        extraData={Array.from(selectedJobIds)}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            No hay trabajos finalizados para este cliente
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
              <TouchableOpacity
                style={[
                  styles.generateButton,
                  { backgroundColor: selectionAccent },
                  isGenerateDisabled && styles.generateButtonDisabled,
                ]}
                onPress={handleGenerateInvoice}
                activeOpacity={0.85}
                disabled={isGenerateDisabled}
              >
                <ThemedText style={[styles.generateButtonText, { color: buttonTextColor }]}>
                  Generar factura
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : null
        }
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
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
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
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionSummary: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectionButtonSpacing: {
    marginLeft: 8,
  },
  selectionButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  generateButton: {
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

