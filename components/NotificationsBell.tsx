import React, { useContext, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthContext } from '@/contexts/AuthContext';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const clampBadgeCount = (value: number) => {
  if (value > 99) return '99+';
  return value.toString();
};

export const NotificationsBell = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username, isLoading: authLoading } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { unreadCount, refreshNotifications } = useContext(NotificationsContext);

  const canListNotifications = useMemo(
    () =>
      permissions.includes('listNotifications') ||
      permissions.includes('markNotificationRead') ||
      permissions.includes('markAllNotificationsRead'),
    [permissions]
  );

  useEffect(() => {
    if (authLoading || !username || !canListNotifications) return;
    void refreshNotifications('unread');
  }, [authLoading, canListNotifications, refreshNotifications, username]);

  const buttonColor = useThemeColor({ light: '#ffffff', dark: 'rgba(17, 24, 39, 0.9)' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.15)', dark: 'rgba(255, 255, 255, 0.25)' }, 'background');
  const iconColor = useThemeColor({}, 'tint');

  if (authLoading || !username || !canListNotifications) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir notificaciones"
        accessibilityHint="Muestra la lista de notificaciones"
        style={({ pressed }) => [
          styles.button,
          {
            top: insets.top + 12,
            right: 16,
            backgroundColor: buttonColor,
            borderColor,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={() => router.push('/notifications')}
      >
        <Ionicons name="notifications-outline" size={24} color={iconColor} />
        <View style={styles.badge} accessibilityLabel={`${unreadCount} notificaciones sin leer`}>
          <Text style={styles.badgeText}>{clampBadgeCount(unreadCount)}</Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
