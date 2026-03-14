import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedView } from '@/components/ThemedView';
import { TrackingContext } from '@/contexts/TrackingContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Sin datos';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('es-AR');
};

const formatDistance = (distance?: number | null) => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) {
    return 'Distancia no disponible';
  }

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distance)} m`;
};

const TrackingScreen = () => {
  const router = useRouter();
  const {
    deviceId,
    policy,
    status,
    nearbyClients,
    recentPoints,
    queueSummary,
    canUseTracking,
    canViewNearbyClients,
    isLoadingPolicy,
    isLoadingStatus,
    isLoadingNearbyClients,
    isSyncing,
    lastSyncError,
    refreshPolicy,
    refreshStatus,
    loadNearbyClients,
    refreshQueueState,
    enqueueTrackingPoint,
    syncPendingPoints,
  } = useContext(TrackingContext);

  const [lat, setLat] = useState('-32.9442');
  const [lng, setLng] = useState('-60.6505');
  const [accuracy, setAccuracy] = useState('18');
  const [speed, setSpeed] = useState('0');
  const [heading, setHeading] = useState('0');
  const [altitude, setAltitude] = useState('0');
  const [state, setState] = useState('standby');
  const [source, setSource] = useState('manual_debug');
  const [refreshing, setRefreshing] = useState(false);

  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#313244' }, 'background');
  const cardBackground = useThemeColor({ light: '#ffffff', dark: '#111827' }, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
  const successColor = '#16a34a';
  const warningColor = '#d97706';
  const dangerColor = '#dc2626';

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshPolicy(),
        refreshStatus(),
        refreshQueueState(),
        canViewNearbyClients ? loadNearbyClients({ limit: 5 }) : Promise.resolve([]),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [canViewNearbyClients, loadNearbyClients, refreshPolicy, refreshQueueState, refreshStatus]);

  useFocusEffect(
    useCallback(() => {
      void handleRefresh();
    }, [handleRefresh]),
  );

  const handleEnqueuePoint = useCallback(async () => {
    const parsedLat = Number(lat.replace(',', '.'));
    const parsedLng = Number(lng.replace(',', '.'));
    const parsedAccuracy = Number(accuracy.replace(',', '.'));
    const parsedSpeed = Number(speed.replace(',', '.'));
    const parsedHeading = Number(heading.replace(',', '.'));
    const parsedAltitude = Number(altitude.replace(',', '.'));

    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      Alert.alert('Latitud inválida', 'Ingresa una latitud entre -90 y 90.');
      return;
    }

    if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      Alert.alert('Longitud inválida', 'Ingresa una longitud entre -180 y 180.');
      return;
    }

    try {
      const sequenceNo = await enqueueTrackingPoint({
        captured_at: new Date().toISOString(),
        lat: parsedLat,
        lng: parsedLng,
        accuracy_m: Number.isFinite(parsedAccuracy) ? parsedAccuracy : null,
        speed_mps: Number.isFinite(parsedSpeed) ? parsedSpeed : null,
        heading_deg: Number.isFinite(parsedHeading) ? parsedHeading : null,
        altitude_m: Number.isFinite(parsedAltitude) ? parsedAltitude : null,
        source: source.trim() || 'manual_debug',
        state: state.trim() || 'standby',
      });
      Alert.alert('Punto encolado', `Se guardó el punto local #${sequenceNo}.`);
    } catch (error) {
      console.error('Error enqueueing tracking point', error);
      Alert.alert('Error', 'No se pudo guardar el punto de tracking.');
    }
  }, [accuracy, altitude, enqueueTrackingPoint, heading, lat, lng, source, speed, state]);

  const handleSync = useCallback(async () => {
    const result = await syncPendingPoints();
    if (!result.attempted) {
      Alert.alert('Sin cambios', 'No hay puntos pendientes para sincronizar.');
      return;
    }

    Alert.alert(
      'Sincronización completa',
      `Intentados: ${result.attempted}\nAceptados: ${result.accepted}\nRechazados: ${result.rejected}`,
    );
  }, [syncPendingPoints]);

  const handleLoadNearby = useCallback(async () => {
    const clients = await loadNearbyClients({ limit: 8, maxDistanceM: 10000 });
    if (!clients.length) {
      Alert.alert('Sin resultados', 'No encontramos clientes cercanos para la última ubicación reconocida.');
    }
  }, [loadNearbyClients]);

  const summaryTone = useMemo(() => {
    if (queueSummary.failed > 0 || lastSyncError) {
      return dangerColor;
    }
    if (queueSummary.pending > 0) {
      return warningColor;
    }
    return successColor;
  }, [dangerColor, lastSyncError, queueSummary.failed, queueSummary.pending, successColor, warningColor]);

  if (!canUseTracking && !canViewNearbyClients) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={accentColor} />
        </TouchableOpacity>
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.title}>Tracking</ThemedText>
          <ThemedText style={[styles.description, { color: mutedColor }]}> 
            Tu usuario no tiene permisos para consultar la policy, sincronizar puntos ni ver clientes cercanos.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[accentColor]} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={accentColor} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <ThemedText style={styles.title}>Tracking</ThemedText>
            <ThemedText style={[styles.description, { color: mutedColor }]}> 
              Panel operativo para policy, cola offline y sincronización manual.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Estado general</ThemedText>
          <ThemedText style={styles.label}>Device ID</ThemedText>
          <ThemedText style={styles.mono}>{deviceId ?? 'Generando...'}</ThemedText>
          <ThemedText style={styles.label}>Policy vigente</ThemedText>
          <ThemedText>
            {policy?.name ?? 'Sin policy'} - {policy?.tracking_profile ?? 'disabled'}
          </ThemedText>
          <ThemedText style={styles.label}>Tracking habilitado</ThemedText>
          <ThemedText>{policy?.tracking_enabled ? 'Sí' : 'No'}</ThemedText>
          <ThemedText style={styles.label}>Último punto reconocido por backend</ThemedText>
          <ThemedText>
            {status?.last_server_point_id ?? status?.location?.point_id ?? 'Sin datos'}
          </ThemedText>
          <ThemedText style={styles.label}>Última ubicación backend</ThemedText>
          <ThemedText>
            {typeof status?.location?.lat === 'number' && typeof status?.location?.lng === 'number'
              ? `${status.location.lat}, ${status.location.lng}`
              : 'Sin ubicación reconocida'}
          </ThemedText>
          <ThemedText style={styles.label}>Capturada</ThemedText>
          <ThemedText>{formatDateTime(status?.location?.captured_at)}</ThemedText>

          <View style={styles.buttonRow}>
            <ThemedButton
              title={isLoadingPolicy ? 'Actualizando...' : 'Actualizar policy'}
              onPress={() => void refreshPolicy()}
              style={styles.flexButton}
              disabled={isLoadingPolicy}
            />
            <ThemedButton
              title={isLoadingStatus ? 'Consultando...' : 'Actualizar estado'}
              onPress={() => void refreshStatus()}
              style={styles.flexButton}
              disabled={isLoadingStatus}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <View style={styles.inlineBetween}>
            <ThemedText style={styles.sectionTitle}>Cola local</ThemedText>
            <View style={[styles.statusPill, { backgroundColor: summaryTone }]}>
              <ThemedText lightColor="#fff" darkColor="#fff" style={styles.statusPillText}>
                {queueSummary.pending} pendientes
              </ThemedText>
            </View>
          </View>
          <ThemedText>Total: {queueSummary.total}</ThemedText>
          <ThemedText>Enviando: {queueSummary.sending}</ThemedText>
          <ThemedText>Ack: {queueSummary.acked}</ThemedText>
          <ThemedText>Fallidos: {queueSummary.failed}</ThemedText>
          <ThemedText>Próxima secuencia: {queueSummary.nextSequenceNo}</ThemedText>
          {lastSyncError ? <ThemedText style={{ color: dangerColor }}>Último error: {lastSyncError}</ThemedText> : null}

          <View style={styles.buttonRow}>
            <ThemedButton
              title={isSyncing ? 'Sincronizando...' : 'Sincronizar cola'}
              onPress={() => void handleSync()}
              style={styles.flexButton}
              disabled={isSyncing || !canUseTracking}
            />
            <ThemedButton
              title="Recargar cola"
              onPress={() => void refreshQueueState()}
              style={styles.flexButton}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Punto manual</ThemedText>
          <ThemedText style={[styles.description, { color: mutedColor }]}> 
            Úsalo para probar el flujo offline-first sin depender todavía de GPS en background.
          </ThemedText>

          <View style={styles.inputRow}>
            <View style={styles.flexField}>
              <ThemedText style={styles.label}>Latitud</ThemedText>
              <ThemedTextInput value={lat} onChangeText={setLat} keyboardType="numeric" />
            </View>
            <View style={styles.flexField}>
              <ThemedText style={styles.label}>Longitud</ThemedText>
              <ThemedTextInput value={lng} onChangeText={setLng} keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.flexField}>
              <ThemedText style={styles.label}>Precisión (m)</ThemedText>
              <ThemedTextInput value={accuracy} onChangeText={setAccuracy} keyboardType="numeric" />
            </View>
            <View style={styles.flexField}>
              <ThemedText style={styles.label}>Velocidad (m/s)</ThemedText>
              <ThemedTextInput value={speed} onChangeText={setSpeed} keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.flexField}>
              <ThemedText style={styles.label}>Rumbo</ThemedText>
              <ThemedTextInput value={heading} onChangeText={setHeading} keyboardType="numeric" />
            </View>
            <View style={styles.flexField}>
              <ThemedText style={styles.label}>Altitud</ThemedText>
              <ThemedTextInput value={altitude} onChangeText={setAltitude} keyboardType="numeric" />
            </View>
          </View>

          <ThemedText style={styles.label}>Estado operativo</ThemedText>
          <ThemedTextInput value={state} onChangeText={setState} autoCapitalize="none" />
          <ThemedText style={styles.label}>Origen</ThemedText>
          <ThemedTextInput value={source} onChangeText={setSource} autoCapitalize="none" />

          <ThemedButton title="Encolar punto" onPress={() => void handleEnqueuePoint()} style={styles.fullButton} />
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <View style={styles.inlineBetween}>
            <ThemedText style={styles.sectionTitle}>Clientes cercanos</ThemedText>
            <ThemedButton
              title={isLoadingNearbyClients ? 'Buscando...' : 'Consultar'}
              onPress={() => void handleLoadNearby()}
              disabled={!canViewNearbyClients || isLoadingNearbyClients}
            />
          </View>
          {!canViewNearbyClients ? (
            <ThemedText style={{ color: mutedColor }}>
              El permiso `listNearbyClients` no está disponible para este usuario.
            </ThemedText>
          ) : nearbyClients.length === 0 ? (
            <ThemedText style={{ color: mutedColor }}>
              Aún no hay clientes cercanos cargados en esta sesión.
            </ThemedText>
          ) : (
            nearbyClients.map(client => (
              <View key={`${client.id}-${client.address_id ?? 'addr'}`} style={[styles.subCard, { borderColor }]}> 
                <ThemedText style={styles.clientTitle}>{client.name}</ThemedText>
                <ThemedText style={{ color: mutedColor }}>
                  {formatDistance(client.distance_m)} - {client.calle ?? 'Sin calle'} {client.numero ?? ''}
                </ThemedText>
                {client.ciudad ? <ThemedText style={{ color: mutedColor }}>{client.ciudad}</ThemedText> : null}
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Últimos puntos locales</ThemedText>
          {recentPoints.length === 0 ? (
            <ThemedText style={{ color: mutedColor }}>Todavía no guardaste puntos en la cola local.</ThemedText>
          ) : (
            recentPoints.map(point => (
              <View key={point.local_id} style={[styles.subCard, { borderColor }]}> 
                <View style={styles.inlineBetween}>
                  <ThemedText style={styles.clientTitle}>Seq #{point.sequence_no}</ThemedText>
                  <ThemedText style={{ color: point.sync_status === 'acked' ? successColor : mutedColor }}>
                    {point.sync_status}
                  </ThemedText>
                </View>
                <ThemedText style={styles.mono}>{point.lat}, {point.lng}</ThemedText>
                <ThemedText style={{ color: mutedColor }}>
                  {point.state ?? 'standby'} - {formatDateTime(point.captured_at)}
                </ThemedText>
                {point.error_message ? (
                  <ThemedText style={{ color: dangerColor }}>{point.error_message}</ThemedText>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
};

export default TrackingScreen;

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
  headerTextWrap: {
    flex: 1,
  },
  backButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    rowGap: 8,
  },
  subCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    rowGap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 10,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
  fullButton: {
    marginTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    columnGap: 10,
  },
  flexField: {
    flex: 1,
  },
  inlineBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 10,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontWeight: '700',
    fontSize: 12,
  },
  clientTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
});
