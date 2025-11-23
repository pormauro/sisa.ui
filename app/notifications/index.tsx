import React, { useCallback, useContext, useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  NotificationsContext,
  type NotificationEntry,
  type NotificationStatus,
} from '@/contexts/NotificationsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('es-AR');
};

const severityColors: Record<string, { background: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { background: '#E5F1FB', text: '#0B60A1', icon: 'information-circle-outline' },
  success: { background: '#E8F6EC', text: '#1B7F4A', icon: 'checkmark-circle-outline' },
  warning: { background: '#FFF4E6', text: '#A24D12', icon: 'warning-outline' },
  error: { background: '#FDE8E8', text: '#B3261E', icon: 'alert-circle-outline' },
};

const NotificationCard = ({
  item,
  onPress,
}: {
  item: NotificationEntry;
  onPress: () => void;
}) => {
  const baseColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#4b3f5f' }, 'background');
  const mutedText = useThemeColor({ light: '#666666', dark: '#c7c7c7' }, 'text');
  const badgeColors = severityColors[item.severity] ?? severityColors.info;

  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, { backgroundColor: baseColor, borderColor }]} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.severityIcon, { backgroundColor: badgeColors.background }]}>
            <Ionicons name={badgeColors.icon} size={20} color={badgeColors.text} />
          </View>
          <View style={styles.headerTextContainer}>
            <ThemedText style={styles.cardTitle} numberOfLines={1}>
              {item.title || 'Notificación'}
            </ThemedText>
            <ThemedText style={[styles.cardDate, { color: mutedText }]}>{formatDateTime(item.created_at)}</ThemedText>
            {item.is_read && (
              <ThemedText style={[styles.cardDate, { color: mutedText }]}>Leída: {formatDateTime(item.read_at)}</ThemedText>
            )}
          </View>
        </View>
      </View>
      <ThemedText style={styles.cardBody} numberOfLines={2}>
        {item.body || 'Sin descripción'}
      </ThemedText>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

const NotificationsScreen = () => {
  const router = useRouter();
  const { notifications, loading, refreshNotifications, markAllAsRead, unreadCount } =
    useContext(NotificationsContext);
  const { permissions } = useContext(PermissionsContext);
  const [filter, setFilter] = useState<NotificationStatus>('unread');
  const [refreshing, setRefreshing] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#dedede', dark: '#433357' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const helperTextColor = useThemeColor({ light: '#4b5563', dark: '#d1d5db' }, 'text');
  const filteredNotifications = useMemo(
    () =>
      notifications.filter(notification => {
        if (notification.is_hidden) return false;
        if (filter === 'unread') {
          return !notification.is_read;
        }
        if (filter === 'read') {
          return notification.is_read;
        }
        return true;
      }),
    [filter, notifications]
  );

  const canListNotifications = useMemo(
    () =>
      permissions.includes('listNotifications') ||
      permissions.includes('markNotificationRead') ||
      permissions.includes('markAllNotificationsRead'),
    [permissions]
  );

  const canMarkAllNotifications = permissions.includes('markAllNotificationsRead');

  useEffect(() => {
    if (permissions.length === 0) return;
    if (!canListNotifications) {
      Alert.alert('Acceso denegado', 'No tienes permisos para ver notificaciones.');
      router.back();
    }
  }, [canListNotifications, permissions.length, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (canListNotifications) {
        await refreshNotifications(filter);
      }
    } finally {
      setRefreshing(false);
    }
  }, [canListNotifications, filter, refreshNotifications]);

  useFocusEffect(
    useCallback(() => {
      if (!canListNotifications) {
        return;
      }
      void refreshNotifications(filter);
    }, [canListNotifications, filter, refreshNotifications])
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationEntry }) => (
      <NotificationCard item={item} onPress={() => router.push(`/notifications/${item.id}`)} />
    ),
    [router]
  );

  const listHeader = (
    <View style={[styles.filterHeader, { borderColor }]}> 
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'unread' && { backgroundColor: tintColor }]}
          onPress={() => setFilter('unread')}
          accessibilityLabel="Ver notificaciones sin leer"
        >
          <View style={styles.filterContent}>
            <Ionicons
              name="mail-unread-outline"
              size={16}
              color={filter === 'unread' ? '#ffffff' : helperTextColor}
            />
            {unreadCount > 0 && (
              <ThemedText style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
                ({unreadCount})
              </ThemedText>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'read' && { backgroundColor: tintColor }]}
          onPress={() => setFilter('read')}
          accessibilityLabel="Ver notificaciones leídas"
        >
          <View style={styles.filterContent}>
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color={filter === 'read' ? '#ffffff' : helperTextColor}
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && { backgroundColor: tintColor }]}
          onPress={() => setFilter('all')}
          accessibilityLabel="Ver todas las notificaciones"
        >
          <View style={styles.filterContent}>
            <Ionicons
              name="notifications-outline"
              size={16}
              color={filter === 'all' ? '#ffffff' : helperTextColor}
            />
          </View>
        </TouchableOpacity>
        <ThemedButton
          title="Marcar todas"
          onPress={() =>
            canMarkAllNotifications
              ? void markAllAsRead()
              : Alert.alert('Acceso denegado', 'No tienes permisos para marcar todas las notificaciones como leídas.')
          }
          style={[styles.markAllButton, { backgroundColor: tintColor }]}
          textStyle={styles.markAllText}
          disabled={!canMarkAllNotifications}
        />
      </View>
      <ThemedText style={[styles.helperText, { color: helperTextColor }]}>
        Usa los botones para ver solo las pendientes, las que ya leíste o todo el historial disponible.
      </ThemedText>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Notificaciones</ThemedText>
          <ThemedText style={styles.subtitle}>Mantente al día con los eventos recientes.</ThemedText>
        </View>
        {loading && notifications.length === 0 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={spinnerColor} />
          </View>
        ) : (
          <FlatList
            data={filteredNotifications}
            keyExtractor={item => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <View style={[styles.emptyStateContainer, { borderColor }]}>
                <ThemedText style={styles.emptyTitle}>Sin notificaciones</ThemedText>
                <ThemedText style={styles.emptyDescription}>
                  No encontramos notificaciones
                  {filter === 'unread' ? ' sin leer' : filter === 'read' ? ' leídas' : ''}.
                </ThemedText>
                <ThemedButton
                  title="Recargar"
                  onPress={() => void refreshNotifications(filter)}
                />
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
            }
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    gap: 12,
  },
  filterHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  filterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterText: {
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  markAllButton: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  markAllText: {
    fontSize: 14,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  severityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 12,
    marginTop: 2,
  },
  cardBody: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff7a00',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDescription: {
    textAlign: 'center',
    marginBottom: 12,
  },
});
