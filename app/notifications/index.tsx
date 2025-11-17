import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { NotificationsContext, type NotificationRecord } from '@/contexts/NotificationsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
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

const NotificationCenterScreen = () => {
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const {
    notifications,
    unreadCount,
    pagination,
    loadingNotifications,
    loadNotifications,
    refreshUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    lastQuery,
  } = useContext(NotificationsContext);

  const canAccessNotifications = useMemo(
    () => permissions.includes('listNotifications') && permissions.includes('markNotificationRead'),
    [permissions]
  );

  const canRegisterDevice = useMemo(() => permissions.includes('registerDevice'), [permissions]);

  const [onlyUnread, setOnlyUnread] = useState(lastQuery.onlyUnread ?? false);
  const [searchInput, setSearchInput] = useState(lastQuery.search ?? '');
  const [appliedSearch, setAppliedSearch] = useState(lastQuery.search ?? '');
  const [refreshing, setRefreshing] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const cardBorderColor = useThemeColor({ light: '#e0e0e0', dark: '#4b3f5f' }, 'background');
  const sectionBorderColor = useThemeColor({ light: '#dcdcdc', dark: '#3c2f4a' }, 'background');
  const mutedTextColor = useThemeColor({ light: '#6b6b6b', dark: '#d1c4e9' }, 'text');
  const inputBackground = useThemeColor({ light: '#ffffff', dark: '#2a2436' }, 'background');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#bbb' }, 'text');
  const spinnerColor = useThemeColor({}, 'tint');
  const unreadBadgeBackground = useThemeColor({ light: '#ffe4d2', dark: '#4a2f1e' }, 'background');
  const unreadBadgeText = useThemeColor({ light: '#a04900', dark: '#ffcc80' }, 'text');

  const fetchNotifications = useCallback(async () => {
    if (!canAccessNotifications) {
      return;
    }
    await loadNotifications({ onlyUnread, search: appliedSearch || undefined, page: 1 });
  }, [appliedSearch, canAccessNotifications, loadNotifications, onlyUnread]);

  useEffect(() => {
    if (!canAccessNotifications) {
      return;
    }
    void fetchNotifications();
  }, [canAccessNotifications, fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      if (!canAccessNotifications) {
        return;
      }
      void refreshUnreadCount();
    }, [canAccessNotifications, refreshUnreadCount])
  );

  const handleApplySearch = useCallback(() => {
    setAppliedSearch(searchInput.trim());
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setAppliedSearch('');
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!canAccessNotifications) {
      return;
    }
    setRefreshing(true);
    try {
      await fetchNotifications();
      await refreshUnreadCount();
    } finally {
      setRefreshing(false);
    }
  }, [canAccessNotifications, fetchNotifications, refreshUnreadCount]);

  const handleToggleRead = useCallback(
    (item: NotificationRecord) => {
      void markNotificationRead(item.id, { read: !item.is_read });
    },
    [markNotificationRead]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!canAccessNotifications) {
      return;
    }
    await markAllNotificationsRead({ read: true });
    await refreshUnreadCount();
  }, [canAccessNotifications, markAllNotificationsRead, refreshUnreadCount]);

  const ListHeader = useMemo(
    () => (
      <View style={[styles.filtersContainer, { borderColor: sectionBorderColor }]}>
        <View style={styles.filterRow}>
          <Switch value={onlyUnread} onValueChange={setOnlyUnread} />
          <ThemedText style={styles.filterLabel}>Solo no leídas</ThemedText>
        </View>
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Buscar por título o contenido"
            placeholderTextColor={placeholderColor}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleApplySearch}
            style={[
              styles.searchInput,
              { backgroundColor: inputBackground, color: mutedTextColor, borderColor: sectionBorderColor },
            ]}
          />
          <View style={styles.searchButtons}>
            <ThemedButton title="Buscar" onPress={handleApplySearch} style={styles.searchButton} />
            <ThemedButton
              title="Limpiar"
              onPress={handleClearSearch}
              lightColor="#ececec"
              darkColor="#4a3c5a"
              lightTextColor="#333"
              darkTextColor="#fff"
              style={styles.searchButton}
            />
          </View>
        </View>
        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryText}>
            {unreadCount === 0 ? 'No tienes notificaciones pendientes' : `${unreadCount} notificaciones sin leer`}
          </ThemedText>
          {unreadCount > 0 ? (
            <ThemedButton title="Marcar todas leídas" onPress={handleMarkAllRead} style={styles.markAllButton} />
          ) : null}
        </View>
        {canRegisterDevice ? (
          <ThemedText style={[styles.helperText, { color: mutedTextColor }]}>
            Tu dispositivo se registra automáticamente al iniciar sesión.
          </ThemedText>
        ) : null}
      </View>
    ),
    [
      canRegisterDevice,
      handleApplySearch,
      handleClearSearch,
      handleMarkAllRead,
      inputBackground,
      mutedTextColor,
      onlyUnread,
      placeholderColor,
      searchInput,
      sectionBorderColor,
      unreadCount,
    ]
  );

  const renderNotification = useCallback(
    ({ item }: { item: NotificationRecord }) => {
      const isUnread = !item.is_read;
      return (
        <TouchableOpacity
          style={[styles.card, { borderColor: cardBorderColor }]}
          onPress={() => router.push(`/notifications/${item.id}`)}
          activeOpacity={0.9}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle} numberOfLines={1}>
              {item.title || 'Notificación sin título'}
            </ThemedText>
            <View style={[styles.statusBadge, isUnread && { backgroundColor: unreadBadgeBackground }]}>
              <ThemedText style={[styles.statusText, isUnread && { color: unreadBadgeText }]}>
                {isUnread ? 'No leída' : 'Leída'}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.cardMeta, { color: mutedTextColor }]}>Evento: {item.event_key}</ThemedText>
          <ThemedText style={[styles.cardMeta, { color: mutedTextColor }]}>Enviada: {formatDateTime(item.sent_at || item.created_at)}</ThemedText>
          <ThemedText style={styles.cardBody} numberOfLines={2}>
            {item.body || 'Sin contenido'}
          </ThemedText>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => handleToggleRead(item)}>
              <ThemedText style={styles.actionText}>
                {item.is_read ? 'Marcar como no leída' : 'Marcar como leída'}
              </ThemedText>
            </TouchableOpacity>
            <ThemedText style={[styles.actionHint, { color: mutedTextColor }]}>Ver detalle</ThemedText>
          </View>
        </TouchableOpacity>
      );
    },
    [cardBorderColor, handleToggleRead, mutedTextColor, router, unreadBadgeBackground, unreadBadgeText]
  );

  if (!canAccessNotifications) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}
      >
        <View style={styles.emptyState}>
          <ThemedText style={styles.screenTitle}>Notificaciones</ThemedText>
          <ThemedText style={styles.emptyStateText}>
            No cuentas con los permisos necesarios para ver el centro de notificaciones.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}
    >
      <View style={styles.header}>
        <ThemedText style={styles.screenTitle}>Notificaciones</ThemedText>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderNotification}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            {loadingNotifications ? (
              <ActivityIndicator color={spinnerColor} />
            ) : (
              <>
                <ThemedText style={styles.emptyStateText}>
                  No se encontraron notificaciones con los filtros actuales.
                </ThemedText>
                {pagination && pagination.total > 0 ? (
                  <ThemedButton
                    title="Restablecer filtros"
                    onPress={() => {
                      setOnlyUnread(false);
                      setSearchInput('');
                      setAppliedSearch('');
                    }}
                  />
                ) : null}
              </>
            )}
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={spinnerColor} />}
        contentContainerStyle={styles.listContent}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  filtersContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    marginLeft: 10,
    fontSize: 16,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  searchButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  markAllButton: {
    paddingHorizontal: 16,
  },
  helperText: {
    marginTop: 12,
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 13,
    marginBottom: 2,
  },
  cardBody: {
    fontSize: 15,
    marginTop: 8,
  },
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionText: {
    fontWeight: '600',
  },
  actionHint: {
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 12,
  },
});

export default NotificationCenterScreen;
