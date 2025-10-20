import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Fuse from 'fuse.js';
import { useFocusEffect, useRouter } from 'expo-router';

import { AfipPointsOfSaleContext, AfipPointOfSale } from '@/contexts/AfipPointsOfSaleContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatPointNumber = (value: number) => value.toString().padStart(4, '0');

const getStatusBadgeStyle = (active: boolean) => {
  if (active) {
    return {
      container: [styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: 'rgba(22,163,74,0.4)' }],
      text: styles.statusText,
      label: 'Activo',
    };
  }
  return {
    container: [styles.statusBadge, { backgroundColor: 'rgba(248,113,113,0.18)', borderColor: 'rgba(220,38,38,0.4)' }],
    text: styles.statusText,
    label: 'Inactivo',
  };
};

export default function AfipPointsOfSaleScreen() {
  const { points, listPoints, togglePoint } = useContext(AfipPointsOfSaleContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [initialising, setInitialising] = useState(false);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
  const borderColor = useThemeColor({ light: '#d1d5db', dark: '#4b5563' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');
  const highlightColor = useThemeColor({ light: '#2563eb', dark: '#60a5fa' }, 'tint');
  const mutedText = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const buttonColor = useThemeColor({}, 'button');

  const canList = permissions.includes('listAfipPointsOfSale');
  const canCreate =
    permissions.includes('createAfipPointOfSale') || permissions.includes('updateAfipPointOfSale');
  const canToggle = permissions.includes('toggleAfipPointOfSale');

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver puntos de venta AFIP.');
      router.back();
    }
  }, [canList, router]);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await listPoints();
    } finally {
      setIsRefreshing(false);
    }
  }, [listPoints]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      setInitialising(true);
      listPoints()
        .catch(() => {})
        .finally(() => setInitialising(false));
    }, [canList, listPoints])
  );

  const fuse = useMemo(() => {
    return new Fuse(points, {
      threshold: 0.3,
      keys: [
        {
          name: 'point_number',
          getFn: (point: AfipPointOfSale) => formatPointNumber(point.point_number),
        },
        'receipt_type',
        'address',
        'description',
      ],
    });
  }, [points]);

  const filteredPoints = useMemo(() => {
    if (!search.trim()) {
      return points;
    }
    const results = fuse.search(search.trim());
    return results.map(result => result.item);
  }, [fuse, points, search]);

  const handleToggle = useCallback(
    (point: AfipPointOfSale) => {
      if (!canToggle) {
        return;
      }

      const nextState = !point.active;
      const actionLabel = nextState ? 'habilitar' : 'deshabilitar';
      Alert.alert(
        `${nextState ? 'Habilitar' : 'Deshabilitar'} punto de venta`,
        `¿Deseas ${actionLabel} el punto de venta ${formatPointNumber(point.point_number)}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            style: 'destructive',
            onPress: async () => {
              setTogglingId(point.id);
              const updated = await togglePoint(point.id, nextState);
              setTogglingId(null);
              if (!updated) {
                Alert.alert('Error', 'No se pudo actualizar el punto de venta.');
              }
            },
          },
        ]
      );
    },
    [canToggle, togglePoint]
  );

  const renderItem = useCallback(
    ({ item }: { item: AfipPointOfSale }) => {
      const badge = getStatusBadgeStyle(item.active);
      const isToggling = togglingId === item.id;

      return (
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: '/afip/points-of-sale/new', params: { id: item.id.toString() } })
          }
          style={[styles.item, { borderColor: itemBorderColor }]}
        >
          <View style={styles.itemHeader}>
            <ThemedText style={styles.itemTitle}>PV {formatPointNumber(item.point_number)}</ThemedText>
            <View style={badge.container}>
              <ThemedText style={badge.text}>{badge.label}</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.itemSubtitle, { color: mutedText }]}>
            {item.receipt_type ? `Comprobantes: ${item.receipt_type}` : 'Comprobantes no informados'}
          </ThemedText>
          <ThemedText style={[styles.itemSubtitle, { color: mutedText }]}>
            {item.address || 'Domicilio no informado'}
          </ThemedText>
          {item.description ? (
            <ThemedText style={[styles.itemDescription, { color: mutedText }]}>{item.description}</ThemedText>
          ) : null}
          {canToggle ? (
            <TouchableOpacity
              style={[styles.toggleButton, { borderColor: highlightColor }]}
              onPress={() => handleToggle(item)}
              disabled={isToggling}
            >
              {isToggling ? (
                <ActivityIndicator size="small" color={highlightColor} />
              ) : (
                <ThemedText style={[styles.toggleButtonText, { color: highlightColor }]}>
                  {item.active ? 'Deshabilitar' : 'Habilitar'}
                </ThemedText>
              )}
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      );
    },
    [canToggle, handleToggle, highlightColor, itemBorderColor, mutedText, router, togglingId]
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}> 
      <View style={styles.header}>
        <TextInput
          style={[
            styles.searchInput,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          placeholder="Buscar punto de venta"
          placeholderTextColor={placeholderColor}
          value={search}
          onChangeText={setSearch}
        />
        {canCreate ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: buttonColor }]}
            onPress={() => router.push('/afip/points-of-sale/new')}
          >
            <ThemedText style={[styles.primaryButtonText, { color: buttonTextColor }]}>Nuevo</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {initialising && points.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={highlightColor} />
        </View>
      ) : (
        <FlatList
          data={filteredPoints}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={filteredPoints.length === 0 ? styles.emptyListContainer : undefined}
          ListEmptyComponent={
            <View style={[styles.emptyState, { borderColor }]}>
              <ThemedText style={[styles.emptyStateText, { color: mutedText }]}> 
                No se encontraron puntos de venta.
              </ThemedText>
            </View>
          }
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={loadData} tintColor={highlightColor} />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 16,
  },
  item: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
