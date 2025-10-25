import React, { useCallback, useContext, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { isStatusFinalized } from '@/hooks/useClientFinalizedJobTotals';
import { sortByNewest } from '@/utils/sort';
import { formatTimeInterval } from '@/utils/time';

type Params = {
  id?: string;
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
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const accentColor = useThemeColor({}, 'tint');

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
      return isStatusFinalized(status);
    });

    return sortByNewest(filtered, getJobSortValue, job => job.id);
  }, [clientId, isValidClientId, jobs, statusById]);

  const renderItem = ({ item }: { item: Job }) => {
    const status = item.status_id != null ? statusById.get(item.status_id) : undefined;
    const date = extractDate(item.job_date);
    const start = extractTime(item.start_time);
    const end = extractTime(item.end_time);
    const interval = formatTimeInterval(start, end);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBackground, borderColor }]}
        onPress={() => router.push(`/jobs/viewModal?id=${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
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
      <FlatList
        data={finalizedJobs}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            No hay trabajos finalizados para este cliente
          </ThemedText>
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
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
});

