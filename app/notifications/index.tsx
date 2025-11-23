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

import { NotificationsContext, type NotificationEntry, type NotificationFilter } from '@/contexts/NotificationsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ConfigContext } from '@/contexts/ConfigContext';
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
  onToggleRead,
  isDimmed,
}: {
  item: NotificationEntry;
  onPress: () => void;
  onToggleRead: () => void;
  isDimmed?: boolean;
}) => {
  const baseColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#4b3f5f' }, 'background');
  const mutedText = useThemeColor({ light: '#666666', dark: '#c7c7c7' }, 'text');
  const badgeColors = severityColors[item.severity] ?? severityColors.info;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { backgroundColor: baseColor, borderColor }, isDimmed && styles.readCard]}
      activeOpacity={0.9}
    >
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
        <TouchableOpacity
          onPress={onToggleRead}
          style={styles.readToggle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ThemedText style={[styles.readToggleText, { color: mutedText }]}>
            {item.is_read ? 'Marcar como no leída' : 'Marcar como leída'}
          </ThemedText>
        </TouchableOpacity>
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
  const { notifications, loading, refreshNotifications, markAsRead, markAsUnread, markAllAsRead, unreadCount } =
    useContext(NotificationsContext);
  const { permissions } = useContext(PermissionsContext);
  const configContext = useContext(ConfigContext);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#dedede', dark: '#433357' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const helperTextColor = useThemeColor({ light: '#4b5563', dark: '#d1d5db' }, 'text');
  const hideBellWhenNoUnread = configContext?.configDetails?.clear_notifications_when_unread_empty ?? false;

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

  const canMarkNotification = permissions.includes('markNotificationRead');
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
        await refreshNotifications(filter, { applyUnreadVisibilityRule: true });
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
      void refreshNotifications(filter, { applyUnreadVisibilityRule: true });
    }, [canListNotifications, filter, refreshNotifications])
  );

  const toggleRead = useCallback(
    async (item: NotificationEntry) => {
      if (!canMarkNotification) {
        Alert.alert('Acceso denegado', 'No tienes permisos para actualizar notificaciones.');
        return;
      }
      const success = item.is_read ? await markAsUnread(item.id) : await markAsRead(item.id);
      if (!success) {
        Alert.alert('Error', 'No se pudo actualizar el estado de la notificación.');
      }
    },
    [canMarkNotification, markAsRead, markAsUnread]
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationEntry }) => (
      <NotificationCard
        item={item}
        onPress={() => router.push(`/notifications/${item.id}`)}
        onToggleRead={() => void toggleRead(item)}
        isDimmed={filter === 'all' && item.is_read}
      />
    ),
    [filter, router, toggleRead]
  );

  const listHeader = (
    <View style={[styles.filterHeader, { borderColor }]}> 
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && { backgroundColor: tintColor }]}
          onPress={() => setFilter('all')}
        >
          <ThemedText style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Todas</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'unread' && { backgroundColor: tintColor }]}
          onPress={() => setFilter('unread')}
        >
          <ThemedText style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
            No leídas ({unreadCount})
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'read' && { backgroundColor: tintColor }]}
          onPress={() => setFilter('read')}
        >
          <ThemedText style={[styles.filterText, filter === 'read' && styles.filterTextActive]}>
            Leídas
          </ThemedText>
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
        Usa los botones para ver todas las notificaciones, solo las pendientes o las que ya leíste. {hideBellWhenNoUnread
          ? 'Si activaste la opción "Ocultar notificaciones cuando no queden sin leer", el ícono solo se ocultará cuando el filtro "No leídas" esté activo y realmente no haya pendientes.'
          : 'El ícono de notificaciones se mantiene visible aunque no haya pendientes, así puedes revisar el historial cuando lo necesites.'}
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
                  {filter === 'unread' ? ' sin leer' : filter === 'read' ? ' leídas' : ' cargadas'}.
                </ThemedText>
                <ThemedButton
                  title="Recargar"
                  onPress={() => void refreshNotifications(filter, { applyUnreadVisibilityRule: true })}
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
  readCard: {
    opacity: 0.6,
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
  readToggle: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  readToggleText: {
    fontSize: 12,
    textDecorationLine: 'underline',
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
