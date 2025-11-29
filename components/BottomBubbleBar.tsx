import React, { useContext, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthContext } from '@/contexts/AuthContext';
import { CompanyContext } from '@/contexts/CompanyContext';
import { ConfigContext } from '@/contexts/ConfigContext';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { CompanySelectorModal } from '@/components/CompanySelectorModal';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useCompanyLogo } from '@/hooks/useCompanyLogo';

interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  badgeValue?: number;
  isActive?: boolean;
  isPrimary?: boolean;
  renderIcon?: () => React.ReactNode;
}

const NavBadge = ({ value, color }: { value: number; color: string }) => {
  const displayValue = value > 99 ? '99+' : value.toString();

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <ThemedText style={styles.badgeText}>{displayValue}</ThemedText>
    </View>
  );
};

export const BottomBubbleBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { username, userId } = useContext(AuthContext);
  const { activeCompany } = useContext(CompanyContext);
  const { permissions } = useContext(PermissionsContext);
  const { notifications, loadNotifications } = useContext(NotificationsContext);
  const configContext = useContext(ConfigContext);
  const [modalVisible, setModalVisible] = useState(false);
  const hasRequestedRef = useRef(false);
  const insets = useSafeAreaInsets();

  const tintColor = useThemeColor({}, 'tint');
  const navBackground = useThemeColor({ light: '#ffffff', dark: '#0f0f14' }, 'background');
  const navBorder = useThemeColor({ light: '#e5e7eb', dark: '#1f2937' }, 'background');
  const mutedColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');
  const cardShadow = useThemeColor({ light: '#00000020', dark: '#00000090' }, 'text');

  const companyLogo = useCompanyLogo(activeCompany?.profile_file_id);
  const companyLabel = activeCompany?.name ?? 'Empresas';

  const canListNotifications = userId === '1' || permissions.includes('listNotifications');
  const showBadgeSetting = configContext?.configDetails?.show_notifications_badge ?? true;

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.state.is_read && !item.state.is_hidden).length,
    [notifications],
  );

  const shouldRender = Boolean(username);

  if (shouldRender && canListNotifications && showBadgeSetting && !hasRequestedRef.current && notifications.length === 0) {
    hasRequestedRef.current = true;
    void loadNotifications({ status: 'unread' });
  }

  if (!shouldRender) {
    return null;
  }

  const navItems: NavItem[] = [
    {
      key: 'home',
      label: 'Inicio',
      icon: 'home-outline',
      activeIcon: 'home',
      onPress: () => router.replace('/Home'),
      isActive: pathname === '/Home',
    },
    {
      key: 'notifications',
      label: 'Avisos',
      icon: 'notifications-outline',
      activeIcon: 'notifications',
      onPress: () => router.push('/notifications'),
      disabled: !canListNotifications,
      badgeValue: canListNotifications && showBadgeSetting ? unreadCount : 0,
      isActive: pathname?.startsWith('/notifications'),
    },
    {
      key: 'company',
      label: companyLabel,
      icon: 'briefcase-outline',
      activeIcon: 'briefcase',
      onPress: () => setModalVisible(true),
      isPrimary: true,
      renderIcon: companyLogo
        ? () => <Image source={{ uri: companyLogo }} style={styles.companyImage} />
        : undefined,
    },
    {
      key: 'profile',
      label: 'Perfil',
      icon: 'person-outline',
      activeIcon: 'person',
      onPress: () => router.push('/user/ProfileScreen'),
      isActive: pathname?.startsWith('/user/ProfileScreen'),
    },
    {
      key: 'settings',
      label: 'Atajos',
      icon: 'flash-outline',
      activeIcon: 'flash',
      onPress: () => router.push('/shortcuts/payment_templates'),
      isActive: pathname?.startsWith('/shortcuts'),
    },
  ];

  const renderNavItem = (item: NavItem) => {
    const isActive = Boolean(item.isActive);
    const isDisabled = Boolean(item.disabled);
    const iconColor = item.isPrimary ? '#ffffff' : isDisabled ? mutedColor : isActive ? tintColor : mutedColor;
    const labelColor = item.isPrimary ? '#ffffff' : isDisabled ? mutedColor : isActive ? tintColor : mutedColor;
    const iconName = isActive && item.activeIcon ? item.activeIcon : item.icon;

    return (
      <TouchableOpacity
        key={item.key}
        style={[styles.navItem, item.isPrimary && styles.navItemPrimary]}
        onPress={item.onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive, disabled: isDisabled }}
      >
        <View
          style={[
            styles.iconWrapper,
            item.isPrimary && [styles.iconWrapperPrimary, { backgroundColor: tintColor }],
          ]}
        >
          {item.renderIcon ? (
            <View style={styles.companyIconWrapper}>{item.renderIcon()}</View>
          ) : (
            <Ionicons name={iconName} size={22} color={iconColor} />
          )}
          {item.badgeValue && item.badgeValue > 0 ? <NavBadge value={item.badgeValue} color={tintColor} /> : null}
        </View>
        <ThemedText
          style={[
            styles.navLabel,
            { color: labelColor },
            isDisabled && styles.navLabelDisabled,
            item.isPrimary && styles.navLabelPrimary,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.bar,
            {
              backgroundColor: navBackground,
              borderColor: navBorder,
              shadowColor: cardShadow,
            },
          ]}
        >
          {navItems.map(renderNavItem)}
        </View>
      </View>

      <CompanySelectorModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 10,
    columnGap: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  navItemPrimary: {
    paddingVertical: 2,
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  iconWrapperPrimary: {
    width: 58,
    height: 58,
    borderRadius: 16,
    marginTop: -12,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  navLabelPrimary: {
    marginTop: -2,
  },
  navLabelDisabled: {
    opacity: 0.4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  companyIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: 'hidden',
  },
  companyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
