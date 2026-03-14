import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { MenuButton } from '@/components/MenuButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { TrackingContext } from '@/contexts/TrackingContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const TrackingIndexScreen = () => {
  const router = useRouter();
  const { canUseTracking, canViewNearbyClients, queueSummary, nearbyClients } = useContext(TrackingContext);

  const accentColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}> 
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { borderColor: accentColor }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={accentColor} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <ThemedText style={styles.title}>Tracking</ThemedText>
          <ThemedText style={[styles.description, { color: mutedColor }]}> 
            Accede a la cola offline de puntos y a la vista de cercania de clientes.
          </ThemedText>
        </View>
      </View>

      <View style={styles.grid}>
        <MenuButton
          title="Cola de puntos"
          subtitle={`Pendientes ${queueSummary.pending} - Fallidos ${queueSummary.failed}`}
          icon="git-compare-outline"
          layout="grid"
          onPress={() => router.push('/tracking/queue')}
          accessibilityState={{ disabled: !canUseTracking }}
          style={!canUseTracking ? styles.disabledCard : undefined}
        />
        <MenuButton
          title="Clientes cercanos"
          subtitle={canViewNearbyClients ? `${nearbyClients.length} cargados` : 'Permiso requerido'}
          icon="location-outline"
          layout="grid"
          onPress={() => router.push('/tracking/nearby-clients')}
          accessibilityState={{ disabled: !canViewNearbyClients }}
          style={!canViewNearbyClients ? styles.disabledCard : undefined}
        />
      </View>
    </ThemedView>
  );
};

export default TrackingIndexScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 12,
    marginBottom: 24,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  disabledCard: {
    opacity: 0.55,
  },
});
