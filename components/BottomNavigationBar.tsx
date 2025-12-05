import React, { useContext, useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/useThemeColor';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';

interface NavigationItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  badge?: number;
  accent?: boolean;
  type?: 'brand' | 'default';
}

const getIsRouteActive = (pathname: string | null, target?: string) => {
  if (!target) return false;
  if (!pathname) return false;
  return pathname === target || pathname.startsWith(`${target}/`);
};

export const BottomNavigationBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const tintColor = useThemeColor({}, 'tint');
  const barBackground = useThemeColor({ light: '#0f0d18', dark: '#0f0d18' }, 'background');
  const mutedColor = useThemeColor({ light: '#cfd0d8', dark: '#cfd0d8' }, 'text');
  const borderColor = useThemeColor({ light: '#232132', dark: '#232132' }, 'border');
  const badgeTextColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');

  const { notifications } = useContext(NotificationsContext);
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  const unreadCount = useMemo(() => {
    const canListNotifications = userId === '1' || permissions.includes('listNotifications');
    if (!canListNotifications) return 0;
    return notifications.filter(item => !item.state.is_read && !item.state.is_hidden).length;
  }, [notifications, permissions, userId]);

  const navItems: NavigationItem[] = useMemo(
    () => [
      { key: 'home', label: 'Inicio', icon: 'home', route: '/Home' },
      { key: 'notifications', label: 'Avisos', icon: 'notifications-outline', route: '/notifications', badge: unreadCount },
      { key: 'brand', label: 'DEPROS', icon: 'aperture', route: '/Home', accent: true, type: 'brand' },
      { key: 'profile', label: 'Perfil', icon: 'person-circle-outline', route: '/user/ProfileScreen' },
      { key: 'shortcuts', label: 'Atajos', icon: 'flash-outline', route: '/shortcuts/payment_templates' },
    ],
    [unreadCount]
  );

  const bottomSpacing = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomSpacing, backgroundColor: barBackground, borderColor }]}>
      <View style={styles.bar}>
        {navItems.map(item => {
          const isActive = getIsRouteActive(pathname, item.route);
          const iconColor = item.type === 'brand' ? tintColor : item.accent ? '#fff' : isActive ? tintColor : mutedColor;
          const labelColor = item.type === 'brand' ? tintColor : item.accent ? '#fff' : isActive ? tintColor : mutedColor;
          const textStyle = [styles.label, { color: labelColor }];

          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.item, item.type === 'brand' && styles.brandItem, isActive && item.type === 'brand' && styles.brandItemActive]}
              onPress={() => item.route && router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              {item.type === 'brand' ? (
                <View style={[styles.brandIcon, { borderColor: tintColor }]}>
                  <Image source={require('@/assets/images/icon.png')} style={styles.brandImage} resizeMode="contain" />
                </View>
              ) : (
                <View>
                  <Ionicons name={item.icon} size={24} color={iconColor} />
                  {item.badge ? (
                    <View style={[styles.badge, { backgroundColor: tintColor }]}>
                      <Text style={[styles.badgeText, { color: badgeTextColor }]} numberOfLines={1}>
                        {item.badge > 99 ? '99+' : String(item.badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
              <Text style={textStyle}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    width: '100%',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  brandItem: {
    flex: 1.15,
  },
  brandItemActive: {
    transform: [{ translateY: -2 }],
  },
  brandIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: '#141223',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  brandImage: {
    width: 40,
    height: 40,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default BottomNavigationBar;
