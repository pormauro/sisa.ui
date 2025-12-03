import React, { useContext, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AuthContext } from '@/contexts/AuthContext';
import { useRequestQueue, type RequestStatus, type RequestTrace } from '@/contexts/RequestQueueContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  aborted: '#6b7280',
};

const formatDate = (timestamp?: number) => {
  if (!timestamp) return 'Pendiente';
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const formatDuration = (duration?: number) => {
  if (duration === undefined || duration === null) return '—';
  if (duration < 1000) return `${duration} ms`;
  const seconds = duration / 1000;
  return `${seconds.toFixed(2)} s`;
};

const StatusPill = ({ status }: { status: RequestStatus }) => (
  <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[status] }]}>
    <ThemedText lightColor="#fff" darkColor="#0b1021" style={styles.statusText}>
      {status.toUpperCase()}
    </ThemedText>
  </View>
);

const RequestCard = ({ trace }: { trace: RequestTrace }) => {
  const tintColor = useThemeColor({}, 'tint');
  const subtitleColor = useThemeColor({ light: '#4a5568', dark: '#cbd5e1' }, 'text');

  return (
    <ThemedView style={[styles.card, { borderColor: tintColor }]}>
      <View style={styles.cardHeader}>
        <StatusPill status={trace.status} />
        <View style={styles.methodPill}> 
          <ThemedText style={styles.methodText}>{trace.method}</ThemedText>
        </View>
      </View>
      <ThemedText style={styles.url} numberOfLines={2}>
        {trace.url}
      </ThemedText>
      <View style={styles.metaRow}>
        <ThemedText style={[styles.metaLabel, { color: subtitleColor }]}>Inicio:</ThemedText>
        <ThemedText>{formatDate(trace.startedAt)}</ThemedText>
      </View>
      <View style={styles.metaRow}>
        <ThemedText style={[styles.metaLabel, { color: subtitleColor }]}>Duración:</ThemedText>
        <ThemedText>{formatDuration(trace.durationMs)}</ThemedText>
      </View>
      <View style={styles.metaRow}>
        <ThemedText style={[styles.metaLabel, { color: subtitleColor }]}>Estado HTTP:</ThemedText>
        <ThemedText>{trace.statusCode ?? '—'}</ThemedText>
      </View>
      {trace.errorMessage ? (
        <ThemedText style={[styles.errorMessage, { color: subtitleColor }]} numberOfLines={2}>
          {trace.errorMessage}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
};

const RequestQueueScreen = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { queue, pendingCount, hydrated, clearQueue } = useRequestQueue();

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({ light: '#6b7280', dark: '#e2e8f0' }, 'text');

  useEffect(() => {
    if (userId && userId !== '1') {
      router.replace('/Home');
    }
  }, [router, userId]);

  const sortedQueue = useMemo(
    () => [...queue].sort((a, b) => b.startedAt - a.startedAt),
    [queue],
  );

  const lastUpdatedAt = sortedQueue.length > 0 ? sortedQueue[0].startedAt : null;

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { borderColor: tintColor }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={tintColor} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Cola de peticiones</ThemedText>
      </View>

      <ThemedView style={[styles.summaryCard, { borderColor: tintColor }]}> 
        <ThemedText style={styles.summaryTitle}>Resumen</ThemedText>
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.metaLabel, { color: mutedColor }]}>Registros:</ThemedText>
          <ThemedText>{sortedQueue.length}</ThemedText>
        </View>
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.metaLabel, { color: mutedColor }]}>Pendientes:</ThemedText>
          <ThemedText>{pendingCount}</ThemedText>
        </View>
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.metaLabel, { color: mutedColor }]}>Última actividad:</ThemedText>
          <ThemedText>{formatDate(lastUpdatedAt ?? undefined)}</ThemedText>
        </View>
        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: tintColor }]}
          onPress={clearQueue}
          disabled={!hydrated || sortedQueue.length === 0}
        >
          <ThemedText lightColor="#fff" style={styles.clearButtonText}>
            Limpiar historial
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {!hydrated ? (
        <ThemedText style={[styles.metaLabel, { color: mutedColor }]}>Cargando historial…</ThemedText>
      ) : sortedQueue.length === 0 ? (
        <ThemedText style={[styles.metaLabel, { color: mutedColor }]}>
          No hay peticiones registradas en esta sesión.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {sortedQueue.map(trace => (
            <RequestCard key={trace.id} trace={trace} />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

export default RequestQueueScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 14,
  },
  clearButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  clearButtonText: {
    fontWeight: '600',
  },
  list: {
    rowGap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontWeight: '700',
  },
  methodPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
  },
  methodText: {
    color: '#fff',
    fontWeight: '700',
  },
  url: {
    fontSize: 14,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorMessage: {
    marginTop: 6,
    fontStyle: 'italic',
  },
});
