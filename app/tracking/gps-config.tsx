import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useContext } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { TrackingContext } from '@/contexts/TrackingContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatValue = (value: unknown, suffix = '') => {
  if (value === null || value === undefined || value === '') {
    return 'No definido';
  }

  if (typeof value === 'boolean') {
    return value ? 'Si' : 'No';
  }

  return `${String(value)}${suffix}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-AR');
};

const GpsConfigScreen = () => {
  const router = useRouter();
  const {
    deviceId,
    policy,
    status,
    canUseTracking,
    isLoadingPolicy,
    isLoadingStatus,
    refreshPolicy,
    refreshStatus,
  } = useContext(TrackingContext);

  const accentColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#ffffff', dark: '#111827' }, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');
  const mutedColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshPolicy(), refreshStatus()]);
  }, [refreshPolicy, refreshStatus]);

  useFocusEffect(
    useCallback(() => {
      if (!canUseTracking) {
        return;
      }
      void refreshAll();
    }, [canUseTracking, refreshAll]),
  );

  if (!canUseTracking && !policy && !status) {
    return (
      <ThemedView style={[styles.container, styles.centered, { backgroundColor }]}>
        <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={accentColor} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Configuracion GPS</ThemedText>
        <ThemedText style={[styles.description, { color: mutedColor }]}>Tu usuario no tiene acceso a la configuracion actual de tracking.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoadingPolicy || isLoadingStatus} onRefresh={() => void refreshAll()} colors={[accentColor]} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={accentColor} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <ThemedText style={styles.title}>Configuracion GPS</ThemedText>
            <ThemedText style={[styles.description, { color: mutedColor }]}>Estado actual de la policy de tracking y de la ultima ubicacion conocida.</ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Identificacion</ThemedText>
          <View style={styles.row}><ThemedText style={styles.label}>Device ID</ThemedText><ThemedText style={styles.value}>{formatValue(deviceId)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Policy</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.name)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Perfil</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.tracking_profile)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Tracking activo</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.tracking_enabled ?? status?.tracking_enabled)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Version policy</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.version)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Asignacion</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.assignment_id)}</ThemedText></View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Parametros GPS</ThemedText>
          <View style={styles.row}><ThemedText style={styles.label}>Alta precision</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.high_accuracy)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Distancia minima</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.distance_filter_m, ' m')}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Muestreo minimo</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.sample_min_seconds, ' s')}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Muestreo maximo</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.sample_max_seconds, ' s')}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Radio de visita</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.visit_radius_m, ' m')}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Batch maximo</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.max_batch_size)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Proximo polling</ThemedText><ThemedText style={styles.value}>{formatValue(policy?.next_poll_after_seconds, ' s')}</ThemedText></View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Ultima lectura conocida</ThemedText>
          <View style={styles.row}><ThemedText style={styles.label}>Latitud</ThemedText><ThemedText style={styles.value}>{formatValue(status?.location?.lat)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Longitud</ThemedText><ThemedText style={styles.value}>{formatValue(status?.location?.lng)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Precision</ThemedText><ThemedText style={styles.value}>{formatValue(status?.location?.accuracy_m, ' m')}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Velocidad</ThemedText><ThemedText style={styles.value}>{formatValue(status?.location?.speed_mps, ' m/s')}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Rumbo</ThemedText><ThemedText style={styles.value}>{formatValue(status?.location?.heading_deg, ' deg')}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Estado</ThemedText><ThemedText style={styles.value}>{formatValue(status?.location?.state)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Capturada</ThemedText><ThemedText style={styles.value}>{formatDateTime(status?.location?.captured_at)}</ThemedText></View>
          <View style={styles.row}><ThemedText style={styles.label}>Ultimo punto backend</ThemedText><ThemedText style={styles.value}>{formatValue(status?.last_server_point_id ?? status?.location?.point_id)}</ThemedText></View>
        </View>

        <View style={styles.buttonRow}>
          <ThemedButton title={isLoadingPolicy ? 'Actualizando policy...' : 'Actualizar policy'} onPress={() => void refreshPolicy()} style={styles.flexButton} disabled={isLoadingPolicy} />
          <ThemedButton title={isLoadingStatus ? 'Actualizando estado...' : 'Actualizar estado'} onPress={() => void refreshStatus()} style={styles.flexButton} disabled={isLoadingStatus} />
        </View>
      </ScrollView>
    </ThemedView>
  );
};

export default GpsConfigScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', padding: 24 },
  content: { padding: 18, paddingBottom: 36, rowGap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', columnGap: 12 },
  backButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800' },
  description: { fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, rowGap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: 12,
    paddingVertical: 6,
  },
  label: { flex: 1, fontSize: 14, fontWeight: '700' },
  value: { flex: 1, fontSize: 14, textAlign: 'right' },
  buttonRow: { flexDirection: 'row', columnGap: 10, paddingHorizontal: 18, paddingBottom: 20 },
  flexButton: { flex: 1 },
});
