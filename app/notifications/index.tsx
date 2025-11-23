import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  NotificationEntry,
  NotificationStatus,
  NotificationsContext,
} from '@/contexts/NotificationsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { AuthContext } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

const STATUS_FILTERS: { key: NotificationStatus; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'No leídas' },
  { key: 'read', label: 'Leídas' },
];

const DEFAULT_NOTIFICATION_STATE = {
  is_read: false,
  read_at: null,
  is_hidden: false,
  hidden_at: null,
  delivered_in_app: false,
  delivered_email: false,
  delivered_push: false,
  last_delivered_at: null,
};

const severityStyle = (
  severity: NotificationEntry['severity'],
  fallbackBackground: string,
): { backgroundColor: string; color: string } => {
  const palette: Record<string, { backgroundColor: string; color: string }> = {
    info: { backgroundColor: '#E6F4FF', color: '#0b60a1' },
    success: { backgroundColor: '#E6F4EA', color: '#2e7d32' },
    warning: { backgroundColor: '#FFF4E6', color: '#a24d12' },
    error: { backgroundColor: '#FCE8E6', color: '#c62828' },
  };
  return palette[severity] ?? { backgroundColor: fallbackBackground, color: '#6b7280' };
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('es-AR');
};

const NotificationCard = ({
  item,
  onMarkRead,
  onHide,
  canMarkRead,
  canHide,
  accent,
  border,
}: {
  item: NotificationEntry;
  onMarkRead: (id: number) => void;
  onHide: (id: number) => void;
  canMarkRead: boolean;
  canHide: boolean;
  accent: string;
  border: string;
}) => {
  const pillColors = severityStyle(item.severity, border);
  const state = { ...DEFAULT_NOTIFICATION_STATE, ...item.state };
  return (
    <ThemedView style={[styles.card, { borderColor: border, opacity: state.is_hidden ? 0.6 : 1 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.pill, { backgroundColor: pillColors.backgroundColor }]}>
          <ThemedText style={[styles.pillText, { color: pillColors.color }]}>
            {item.severity?.toString().toUpperCase() ?? 'INFO'}
          </ThemedText>
        </View>
        <View style={styles.stateContainer}>
          <View
            style={[styles.stateDot, { backgroundColor: state.is_read ? '#10B981' : '#F97316' }]}
          />
          <ThemedText style={styles.stateText}>
            {state.is_read ? 'Leída' : 'Pendiente'}
          </ThemedText>
          {state.is_hidden && <ThemedText style={styles.hiddenBadge}>Oculta</ThemedText>}
        </View>
      </View>

      <ThemedText style={styles.notificationTitle}>{item.title || 'Notificación'}</ThemedText>
      <ThemedText style={styles.body}>
        {item.body || 'Sin descripción disponible para esta notificación.'}
      </ThemedText>

      <View style={styles.metaRow}>
        <ThemedText style={styles.metaText}>
          Creada: {formatDateTime(item.timestamps.created_at ?? item.timestamps.sent_at)}
        </ThemedText>
        {item.company_id !== null && (
          <ThemedText style={styles.metaText}>Empresa #{item.company_id}</ThemedText>
        )}
      </View>

      {item.source && (
        <ThemedText style={styles.metaText}>
          Origen: {item.source.table ?? 'N/D'} · ID: {item.source.id ?? '-'} · Historial:{' '}
          {item.source.history_id ?? '-'}
        </ThemedText>
      )}

      {(canMarkRead || canHide) && (
        <View style={styles.actionsRow}>
          {canMarkRead && !state.is_read && (
            <ThemedButton
              title="Marcar como leída"
              onPress={() => onMarkRead(item.id)}
              style={[styles.actionButton, { backgroundColor: accent }]}
            />
          )}
          {canHide && !state.is_hidden && (
            <ThemedButton
              title="Ocultar"
              onPress={() => onHide(item.id)}
              style={[styles.actionButton, { backgroundColor: '#6B7280' }]}
            />
          )}
        </View>
      )}
    </ThemedView>
  );
};

const NotificationsScreen = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const {
    notifications,
    loadNotifications,
    markAsRead,
    hideNotification,
    markAllAsRead,
    loading,
    filters,
  } = useContext(NotificationsContext);

  const [selectedStatus, setSelectedStatus] = useState<NotificationStatus>(filters.status ?? 'all');
  const [refreshing, setRefreshing] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#40314f' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');

  const canList = useMemo(
    () => userId === '1' || permissions.includes('listNotifications'),
    [permissions, userId],
  );
  const canMarkRead = useMemo(
    () => userId === '1' || permissions.includes('markNotificationRead'),
    [permissions, userId],
  );
  const canHide = useMemo(
    () => userId === '1' || permissions.includes('hideNotification'),
    [permissions, userId],
  );
  const canMarkAll = useMemo(
    () => userId === '1' || permissions.includes('markAllNotificationsRead'),
    [permissions, userId],
  );
  const canSendManual = useMemo(
    () => userId === '1' || permissions.includes('sendNotifications'),
    [permissions, userId],
  );

  useFocusEffect(
    useCallback(() => {
      if (!canList) return;
      void loadNotifications({ status: selectedStatus });
    }, [canList, loadNotifications, selectedStatus]),
  );

  const handleRefresh = useCallback(async () => {
    if (!canList) return;
    setRefreshing(true);
    try {
      await loadNotifications({ status: selectedStatus });
    } finally {
      setRefreshing(false);
    }
  }, [canList, loadNotifications, selectedStatus]);

  const handleMarkRead = useCallback(
    (id: number) => {
      void markAsRead(id, { read_at: new Date().toISOString() });
    },
    [markAsRead],
  );

  const handleHide = useCallback(
    (id: number) => {
      void hideNotification(id, { hidden_at: new Date().toISOString() });
    },
    [hideNotification],
  );

  const handleMarkAll = useCallback(async () => {
    const updated = await markAllAsRead();
    if (updated > 0) {
      await loadNotifications({ status: selectedStatus });
    }
  }, [loadNotifications, markAllAsRead, selectedStatus]);

  const filteredNotifications = useMemo(() => {
    if (!canList) return [];
    const safeNotifications = notifications.map(item => ({
      ...item,
      state: { ...DEFAULT_NOTIFICATION_STATE, ...item.state },
    }));
    if (selectedStatus === 'unread') {
      return safeNotifications.filter(item => !item.state.is_read && !item.state.is_hidden);
    }
    if (selectedStatus === 'read') {
      return safeNotifications.filter(item => item.state.is_read);
    }
    return safeNotifications.filter(item => !item.state.is_hidden);
  }, [canList, notifications, selectedStatus]);

  const unreadCount = useMemo(
    () => filteredNotifications.filter(item => !item.state.is_read && !item.state.is_hidden).length,
    [filteredNotifications],
  );

  if (!canList) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}> 
        <ThemedText style={styles.blockedTitle}>No tenés permisos para ver notificaciones.</ThemedText>
        <ThemedText style={styles.blockedDescription}>
          Solicitá el permiso &quot;listNotifications&quot; o ingresá como superusuario.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}> 
      <View style={styles.header}> 
        <ThemedText style={styles.screenTitle}>Notificaciones</ThemedText>
        {canSendManual && (
          <TouchableOpacity
            onPress={() => router.push('/notifications/send')}
            style={[styles.secondaryButton, { borderColor: tintColor }]}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: tintColor }]}>Enviar</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}> 
        {STATUS_FILTERS.map(option => {
          const isActive = option.key === selectedStatus;
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.filterChip,
                { borderColor: tintColor, backgroundColor: isActive ? tintColor : 'transparent' },
              ]}
              onPress={() => {
                setSelectedStatus(option.key);
                void loadNotifications({ status: option.key });
              }}
            >
              <ThemedText
                style={{
                  color: isActive ? '#FFFFFF' : tintColor,
                  fontWeight: isActive ? '700' : '500',
                }}
              >
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      {canMarkAll && unreadCount > 0 && (
        <ThemedButton
          title={`Marcar ${unreadCount} como leídas`}
          onPress={handleMarkAll}
          style={[styles.markAllButton, { backgroundColor: tintColor }]}
        />
      )}

      {loading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={spinnerColor} />
          <ThemedText style={styles.loadingText}>Cargando notificaciones…</ThemedText>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={[styles.emptyStateContainer, { borderColor }]}> 
          <ThemedText style={styles.emptyStateTitle}>Sin notificaciones</ThemedText>
          <ThemedText style={styles.emptyStateDescription}>
            No encontramos notificaciones para este filtro. Desliza hacia abajo para actualizar.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={item => `${item.id}`}
          renderItem={({ item }) => (
            <NotificationCard
              item={item}
              onMarkRead={handleMarkRead}
              onHide={handleHide}
              canMarkRead={canMarkRead}
              canHide={canHide}
              accent={tintColor}
              border={borderColor}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={spinnerColor}
              colors={[spinnerColor]}
            />
          }
          ListFooterComponent={<View style={{ height: 60 }} />}
        />
      )}
    </ThemedView>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  listContent: {
    paddingBottom: 20,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontWeight: '700',
    fontSize: 12,
  },
  stateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stateText: {
    fontWeight: '600',
  },
  hiddenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#4B5563',
    color: '#FFFFFF',
    borderRadius: 999,
    fontSize: 12,
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyStateContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyStateDescription: {
    textAlign: 'center',
    color: '#6b7280',
  },
  markAllButton: {
    marginBottom: 12,
    borderRadius: 12,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '700',
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  blockedDescription: {
    fontSize: 15,
    color: '#6b7280',
  },
});
