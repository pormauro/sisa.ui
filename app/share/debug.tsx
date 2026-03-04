import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { clearShareDebugHistory, getShareDebugHistory, type ShareDebugEntry } from '@/utils/shareDebug';

const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString('es-AR');

const stringifyPayload = (value: unknown) => {
  if (value === undefined) return 'Sin datos disponibles';
  if (value === null) return 'null';
  if (typeof value === 'string') return value || 'Cadena vacía';

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return `No se pudo serializar el contenido: ${String(error)}`;
  }
};

const ShareDebugScreen = () => {
  const [entries, setEntries] = useState<ShareDebugEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#312e81' }, 'background');
  const emptyIconColor = useThemeColor({ light: '#9ca3af', dark: '#cbd5e1' }, 'text');
  const subtleBackground = useThemeColor({ light: '#f8fafc', dark: '#1f2937' }, 'background');

  const loadEntries = useCallback(async () => {
    const next = await getShareDebugHistory();
    const sorted = [...next].sort((a, b) => b.timestamp - a.timestamp);
    setEntries(sorted);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
    }, [loadEntries])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEntries();
    } finally {
      setRefreshing(false);
    }
  }, [loadEntries]);

  const handleClear = useCallback(async () => {
    await clearShareDebugHistory();
    setEntries([]);
  }, []);

  const total = useMemo(() => entries.length, [entries.length]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="share-social-outline" size={24} color={emptyIconColor} />
          <ThemedText style={styles.title}>Depurador de Share</ThemedText>
        </View>
        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionButton, { borderColor }]} onPress={() => void handleRefresh()}>
            <Ionicons name="refresh" size={18} color={emptyIconColor} />
            <ThemedText style={styles.actionText}>Actualizar</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { borderColor }, total === 0 && styles.actionButtonDisabled]}
            disabled={total === 0}
            onPress={() => void handleClear()}
          >
            <Ionicons name="trash-outline" size={18} color={emptyIconColor} />
            <ThemedText style={styles.actionText}>Limpiar</ThemedText>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={44} color={emptyIconColor} />
            <ThemedText style={styles.emptyText}>Sin eventos de share por mostrar.</ThemedText>
          </View>
        }
        contentContainerStyle={entries.length === 0 ? styles.emptyList : styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.stageText}>{item.stage}</ThemedText>
              <ThemedText style={styles.dateText}>{formatDateTime(item.timestamp)}</ThemedText>
            </View>
            <ThemedText style={styles.metaText}>Campos cambiados: {item.changedKeys.join(', ') || 'ninguno'}</ThemedText>
            <View style={[styles.payloadBox, { backgroundColor: subtleBackground }]}>
              <ThemedText selectable style={styles.payloadText}>{stringifyPayload(item.values)}</ThemedText>
            </View>
          </View>
        )}
      />
    </ThemedView>
  );
};

export default ShareDebugScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  header: {
    gap: 12,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    gap: 10,
    paddingBottom: 30,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  stageText: {
    flex: 1,
    fontWeight: '700',
    fontSize: 15,
  },
  dateText: {
    fontSize: 12,
    opacity: 0.8,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.9,
  },
  payloadBox: {
    borderRadius: 8,
    padding: 10,
  },
  payloadText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
  },
});
