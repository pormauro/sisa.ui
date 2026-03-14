import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useContext, useMemo } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { TrackingContext } from '@/contexts/TrackingContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-AR');
};

const statusColor = (status: string) => {
  if (status === 'acked') return '#16a34a';
  if (status === 'sending') return '#2563eb';
  if (status === 'failed') return '#dc2626';
  return '#d97706';
};

const TrackingQueueScreen = () => {
  const router = useRouter();
  const {
    deviceId,
    runtimeState,
    recentPoints,
    queueSummary,
    canUseTracking,
    isSyncing,
    lastSyncError,
    captureCurrentLocation,
    refreshQueueState,
    syncPendingPoints,
  } = useContext(TrackingContext);

  const accentColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');
  const cardBackground = useThemeColor({ light: '#ffffff', dark: '#111827' }, 'background');
  const mutedColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');

  const handleRefresh = useCallback(async () => {
    await refreshQueueState();
  }, [refreshQueueState]);

  useFocusEffect(
    useCallback(() => {
      void handleRefresh();
    }, [handleRefresh]),
  );

  const summaryItems = useMemo(
    () => [
      { label: 'Pendientes', value: queueSummary.pending },
      { label: 'Enviando', value: queueSummary.sending },
      { label: 'Confirmados', value: queueSummary.acked },
      { label: 'Fallidos', value: queueSummary.failed },
    ],
    [queueSummary.acked, queueSummary.failed, queueSummary.pending, queueSummary.sending],
  );

  const handleSync = useCallback(async () => {
    const result = await syncPendingPoints();
    Alert.alert(
      'Sincronizacion',
      result.attempted
        ? `Intentados: ${result.attempted}\nAceptados: ${result.accepted}\nRechazados: ${result.rejected}`
        : 'No hay puntos pendientes para sincronizar.',
    );
  }, [syncPendingPoints]);

  const handleForcePoint = useCallback(async () => {
    try {
      const sequenceNo = await captureCurrentLocation();
      Alert.alert('Punto GPS guardado', `Se agrego el punto local #${sequenceNo} usando el GPS del telefono.`);
      await refreshQueueState();
    } catch (error) {
      console.error('Error forcing tracking point', error);
      Alert.alert('Error', 'No se pudo capturar la ubicacion actual. Revisa permisos y GPS del telefono.');
    }
  }, [captureCurrentLocation, refreshQueueState]);

  if (!canUseTracking) {
    return (
      <ThemedView style={[styles.container, styles.centered, { backgroundColor }]}> 
        <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={accentColor} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Cola de puntos</ThemedText>
        <ThemedText style={[styles.description, { color: mutedColor }]}> 
          Tu usuario no tiene permisos para consultar o sincronizar tracking.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void handleRefresh()} colors={[accentColor]} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={accentColor} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <ThemedText style={styles.title}>Cola de puntos</ThemedText>
            <ThemedText style={[styles.description, { color: mutedColor }]}> 
              Visualiza la cola local de tracking y el estado de cada punto antes de sincronizar.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Resumen</ThemedText>
          <ThemedText style={styles.metaLine}>Device ID: {deviceId ?? 'Generando...'}</ThemedText>
          <ThemedText style={styles.metaLine}>Total en cola: {queueSummary.total}</ThemedText>
          <ThemedText style={styles.metaLine}>Proxima secuencia: {queueSummary.nextSequenceNo}</ThemedText>
          <ThemedText style={styles.metaLine}>Task GPS: {runtimeState.isTrackingActive ? 'Activo' : 'Detenido'}</ThemedText>
          <ThemedText style={styles.metaLine}>Ultima captura local: {formatDateTime(runtimeState.lastLocalCaptureAt)}</ThemedText>
          {lastSyncError ? <ThemedText style={styles.errorText}>Ultimo error: {lastSyncError}</ThemedText> : null}
          <View style={styles.summaryGrid}>
            {summaryItems.map(item => (
              <View key={item.label} style={[styles.summaryBox, { borderColor }]}> 
                <ThemedText style={styles.summaryValue}>{item.value}</ThemedText>
                <ThemedText style={[styles.summaryLabel, { color: mutedColor }]}>{item.label}</ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.buttonRow}>
            <ThemedButton
              title={isSyncing ? 'Sincronizando...' : 'Sincronizar cola'}
              onPress={() => void handleSync()}
              style={styles.flexButton}
              disabled={isSyncing}
            />
            <ThemedButton title="Recargar" onPress={() => void handleRefresh()} style={styles.flexButton} />
          </View>
          <ThemedButton
            title="Capturar GPS ahora"
            onPress={() => void handleForcePoint()}
          />
          <ThemedText style={[styles.helperText, { color: mutedColor }]}>Toma una lectura real del GPS del telefono y la encola para sincronizarla enseguida.</ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Puntos en cola</ThemedText>
          {recentPoints.length === 0 ? (
            <ThemedText style={[styles.description, { color: mutedColor }]}> 
              Todavia no hay puntos guardados localmente.
            </ThemedText>
          ) : (
            recentPoints.map(point => (
              <View key={point.local_id} style={[styles.pointCard, { borderColor }]}> 
                <View style={styles.pointHeader}>
                  <ThemedText style={styles.pointTitle}>Seq #{point.sequence_no}</ThemedText>
                  <View style={[styles.statusPill, { backgroundColor: statusColor(point.sync_status) }]}> 
                    <ThemedText lightColor="#fff" darkColor="#fff" style={styles.statusText}>
                      {point.sync_status}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.metaLine}>{point.lat}, {point.lng}</ThemedText>
                <ThemedText style={[styles.metaLine, { color: mutedColor }]}> 
                  {point.state ?? 'standby'} - {formatDateTime(point.captured_at)}
                </ThemedText>
                {typeof point.accuracy_m === 'number' ? (
                  <ThemedText style={[styles.metaLine, { color: mutedColor }]}>Precision: {point.accuracy_m} m</ThemedText>
                ) : null}
                {point.error_message ? <ThemedText style={styles.errorText}>{point.error_message}</ThemedText> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
};

export default TrackingQueueScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
    rowGap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    rowGap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  metaLine: {
    fontSize: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  summaryBox: {
    flexBasis: '48%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 10,
  },
  flexButton: {
    flex: 1,
  },
  pointCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    rowGap: 4,
  },
  pointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 10,
  },
  pointTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
  },
  helperText: {
    fontSize: 12,
  },
});
