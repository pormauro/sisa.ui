import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useContext } from 'react';
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

const formatDistance = (distance?: number | null) => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) return 'Sin distancia';
  if (distance >= 1000) return `${(distance / 1000).toFixed(1)} km`;
  return `${Math.round(distance)} m`;
};

const NearbyClientsScreen = () => {
  const router = useRouter();
  const {
    canViewNearbyClients,
    nearbyClients,
    status,
    isLoadingNearbyClients,
    loadNearbyClients,
  } = useContext(TrackingContext);

  const accentColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');
  const cardBackground = useThemeColor({ light: '#ffffff', dark: '#111827' }, 'background');
  const mutedColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');

  const refreshNearby = useCallback(async () => {
    const clients = await loadNearbyClients({ limit: 20, maxDistanceM: 30000 });
    if (!clients.length) {
      Alert.alert('Sin resultados', 'No encontramos clientes cercanos para la ubicacion actual del backend.');
    }
  }, [loadNearbyClients]);

  useFocusEffect(
    useCallback(() => {
      if (!canViewNearbyClients) {
        return;
      }
      void loadNearbyClients({ limit: 20, maxDistanceM: 30000 });
    }, [canViewNearbyClients, loadNearbyClients]),
  );

  if (!canViewNearbyClients) {
    return (
      <ThemedView style={[styles.container, styles.centered, { backgroundColor }]}> 
        <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={accentColor} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Clientes cercanos</ThemedText>
        <ThemedText style={[styles.description, { color: mutedColor }]}> 
          Tu usuario no tiene el permiso `listNearbyClients`.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoadingNearbyClients} onRefresh={() => void refreshNearby()} colors={[accentColor]} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={accentColor} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <ThemedText style={styles.title}>Clientes cercanos</ThemedText>
            <ThemedText style={[styles.description, { color: mutedColor }]}> 
              Lista ordenada por distancia usando la ultima ubicacion reconocida por el backend.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Referencia de ubicacion</ThemedText>
          <ThemedText style={styles.metaLine}>
            {typeof status?.location?.lat === 'number' && typeof status?.location?.lng === 'number'
              ? `${status.location.lat}, ${status.location.lng}`
              : 'Sin ubicacion reconocida'}
          </ThemedText>
          <ThemedText style={[styles.metaLine, { color: mutedColor }]}> 
            Capturada: {formatDateTime(status?.location?.captured_at)}
          </ThemedText>
          <ThemedButton
            title={isLoadingNearbyClients ? 'Buscando...' : 'Actualizar cercania'}
            onPress={() => void refreshNearby()}
            disabled={isLoadingNearbyClients}
          />
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.sectionTitle}>Resultado por distancia</ThemedText>
          {nearbyClients.length === 0 ? (
            <ThemedText style={[styles.description, { color: mutedColor }]}> 
              No hay clientes cercanos cargados todavia.
            </ThemedText>
          ) : (
            nearbyClients.map((client, index) => (
              <View key={`${client.id}-${client.address_id ?? index}`} style={[styles.clientCard, { borderColor }]}> 
                <View style={styles.clientHeader}>
                  <ThemedText style={styles.clientName}>{client.name}</ThemedText>
                  <View style={styles.rankBadge}>
                    <ThemedText style={styles.rankText}>#{index + 1}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.distanceText}>{formatDistance(client.distance_m)}</ThemedText>
                <ThemedText style={[styles.metaLine, { color: mutedColor }]}> 
                  {client.address_label ?? 'Direccion principal'}
                </ThemedText>
                <ThemedText style={[styles.metaLine, { color: mutedColor }]}> 
                  {client.calle ?? 'Sin calle'} {client.numero ?? ''}
                </ThemedText>
                {client.ciudad ? <ThemedText style={[styles.metaLine, { color: mutedColor }]}>{client.ciudad}</ThemedText> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
};

export default NearbyClientsScreen;

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
  clientCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    rowGap: 4,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 10,
  },
  clientName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  distanceText: {
    fontSize: 20,
    fontWeight: '800',
  },
  rankBadge: {
    minWidth: 32,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#0f766e',
    alignItems: 'center',
  },
  rankText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
