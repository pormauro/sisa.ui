import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ConfigContext } from '@/contexts/ConfigContext';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { useThemeColor } from '@/hooks/useThemeColor';

export const NotificationMenuBadge: React.FC = () => {
  const { notifications, loadNotifications } = useContext(NotificationsContext);
  const { permissions } = useContext(PermissionsContext);
  const { userId } = useContext(AuthContext);
  const configContext = useContext(ConfigContext);
  const router = useRouter();
  const hasRequestedRef = useRef(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#2a2432' }, 'background');
  const textColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');

  const canListNotifications = userId === '1' || permissions.includes('listNotifications');
  const showBadgeSetting = configContext?.configDetails?.show_notifications_badge ?? true;

  const unreadCount = useMemo(
    () => notifications.filter(item => !item.state.is_read && !item.state.is_hidden).length,
    [notifications],
  );

  useEffect(() => {
    if (!canListNotifications || !showBadgeSetting) {
      return;
    }

    if (hasRequestedRef.current || notifications.length > 0) {
      return;
    }

    hasRequestedRef.current = true;
    void loadNotifications({ status: 'unread' });
  }, [canListNotifications, loadNotifications, notifications.length, showBadgeSetting]);

  if (!canListNotifications || !showBadgeSetting || unreadCount === 0) {
    return null;
  }

  const displayValue = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor, borderColor: tintColor }]}
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel="Abrir notificaciones"
      accessibilityHint="Muestra las notificaciones pendientes"
    >
      <Ionicons name="notifications" size={18} color={tintColor} />
      <View style={[styles.badge, { backgroundColor: tintColor }]}>
        <Text style={[styles.badgeText, { color: textColor }]}>{displayValue}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
    flexShrink: 0,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
