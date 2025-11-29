import React, { useContext, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

const Bubble = ({
  children,
  onPress,
  size = 68,
  elevated = true,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  elevated?: boolean;
  disabled?: boolean;
}) => {
  const background = useThemeColor({ light: '#ffffff', dark: '#1f1f23' }, 'background');
  const shadowColor = useThemeColor({ light: '#000', dark: '#000' }, 'text');

  return (
    <TouchableOpacity
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
        },
        elevated && {
          shadowColor,
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
      ]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {children}
    </TouchableOpacity>
  );
};

const BubbleBadge = ({ value }: { value: number }) => {
  const textColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');
  const background = useThemeColor({}, 'tint');
  const displayValue = value > 99 ? '99+' : value.toString();

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <ThemedText style={[styles.badgeText, { color: textColor }]}>{displayValue}</ThemedText>
    </View>
  );
};

const ActiveCompanyBubble = ({ onPress }: { onPress: () => void }) => {
  const { activeCompany } = useContext(CompanyContext);
  const logoUri = useCompanyLogo(activeCompany?.profile_file_id);
  const background = useThemeColor({ light: '#f4f4f5', dark: '#1f1f23' }, 'background');
  const textColor = useThemeColor({ light: '#111827', dark: '#f3f4f6' }, 'text');
  const accent = useThemeColor({}, 'tint');

  const initials = useMemo(() => {
    if (!activeCompany?.name) return 'S';
    const words = activeCompany.name.trim().split(/\s+/).slice(0, 2);
    return words.map((word) => word.charAt(0).toUpperCase()).join('') || 'S';
  }, [activeCompany?.name]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.companyBubbleContent}>
      <View style={[styles.companyCircle, { backgroundColor: background }]}>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.companyImage} />
        ) : (
          <ThemedText style={[styles.companyInitials, { color: textColor }]}>{initials}</ThemedText>
        )}
      </View>
      <ThemedText style={[styles.companyLabel, { color: accent }]} numberOfLines={1}>
        {activeCompany?.name ?? 'Seleccionar empresa'}
      </ThemedText>
    </TouchableOpacity>
  );
};

export const BottomBubbleBar: React.FC = () => {
  const router = useRouter();
  const { username, userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { notifications, loadNotifications } = useContext(NotificationsContext);
  const configContext = useContext(ConfigContext);
  const [modalVisible, setModalVisible] = useState(false);
  const hasRequestedRef = useRef(false);
  const insets = useSafeAreaInsets();

  const tintColor = useThemeColor({}, 'tint');
  const background = useThemeColor({ light: '#f9fafb', dark: '#0f0f14' }, 'background');

  const canListNotifications = userId === '1' || permissions.includes('listNotifications');
  const showBadgeSetting = configContext?.configDetails?.show_notifications_badge ?? true;

  const unreadCount = useMemo(
    () =>
      notifications.filter((item) => !item.state.is_read && !item.state.is_hidden).length,
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

  return (
    <>
      <View
        style={[
          styles.container,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            paddingHorizontal: 32,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.bar, { backgroundColor: background }]}> 
          <Bubble onPress={() => router.push('/notifications')} disabled={!canListNotifications}>
            <Ionicons name="notifications" size={28} color={tintColor} />
            {canListNotifications && showBadgeSetting && unreadCount > 0 ? (
              <BubbleBadge value={unreadCount} />
            ) : null}
          </Bubble>

          <Bubble onPress={() => setModalVisible(true)} size={82}>
            <ActiveCompanyBubble onPress={() => setModalVisible(true)} />
          </Bubble>

          <Bubble onPress={() => router.push('/user/ProfileScreen')}>
            <Ionicons name="person" size={28} color={tintColor} />
          </Bubble>
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
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 18,
    columnGap: 18,
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
  },
  companyBubbleContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  companyCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  companyInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  companyImage: {
    width: '100%',
    height: '100%',
  },
  companyLabel: {
    maxWidth: 120,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});
