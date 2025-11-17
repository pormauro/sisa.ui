import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { NotificationsContext } from '@/contexts/NotificationsContext';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useContext, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/MenuButton';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { MENU_SECTIONS, MenuItem, SHORTCUTS_SECTION } from '@/constants/menuSections';
import { Ionicons } from '@expo/vector-icons';

const Menu: React.FC = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { unreadCount, refreshUnreadCount } = useContext(NotificationsContext);

  // Función para determinar si se deben mostrar los elementos con permisos requeridos.
  const isEnabled = (item: MenuItem): boolean => {
    // El botón de permisos siempre está disponible para el usuario maestro.
    if (item.route === '/permission' && userId === '1') return true;
    // Si no hay permisos requeridos, se muestra.
    if (!item.requiredPermissions) return true;
    // De lo contrario, se verifica que el usuario tenga todos los permisos requeridos.
    const hasRequired = item.requiredPermissions.every(perm => permissions.includes(perm));
    if (hasRequired) {
      return true;
    }

    if (item.fallbackPermissions?.some(perm => permissions.includes(perm))) {
      return true;
    }

    return false;
  };

  const canAccessNotifications = useMemo(
    () => permissions.includes('listNotifications') && permissions.includes('markNotificationRead'),
    [permissions]
  );

  useFocusEffect(
    useCallback(() => {
      if (!canAccessNotifications) {
        return;
      }
      void refreshUnreadCount();
    }, [canAccessNotifications, refreshUnreadCount])
  );

  const visibleShortcutsSection = {
    ...SHORTCUTS_SECTION,
    items: SHORTCUTS_SECTION.items.filter(isEnabled),
  };

  const visibleSections = [
    ...(visibleShortcutsSection.items.length > 0 ? [visibleShortcutsSection] : []),
    ...MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(isEnabled),
    })).filter((section) => section.items.length > 0),
  ];

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const headerIconColor = useThemeColor({}, 'tint');
  const headerIconBackground = useThemeColor({ light: '#f2f0ff', dark: '#3a2d4f' }, 'background');
  const badgeBackground = useThemeColor({ light: '#e53935', dark: '#ff8a80' }, 'tint');

  const handleNotificationsPress = useCallback(() => {
    if (!canAccessNotifications) {
      return;
    }
    router.push('/notifications');
  }, [canAccessNotifications, router]);

  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount.toString();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ScrollView style={{ backgroundColor }} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Menú Principal</ThemedText>
          {canAccessNotifications ? (
            <TouchableOpacity
              accessibilityLabel="Abrir notificaciones"
              style={[styles.headerIconContainer, { backgroundColor: headerIconBackground }]}
              activeOpacity={0.85}
              onPress={handleNotificationsPress}
            >
              <Ionicons name="notifications-outline" size={22} color={headerIconColor} />
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: badgeBackground }]}
                >
                  <ThemedText style={styles.badgeText}>{unreadLabel}</ThemedText>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : (
            <View style={[styles.headerIconContainer, { backgroundColor: headerIconBackground }]}
            >
              <Ionicons name="notifications-off-outline" size={22} color={headerIconColor} />
            </View>
          )}
        </View>
        <View style={styles.sectionsContainer}>
          {visibleSections.length === 0 ? (
            <View style={[styles.emptyStateContainer, { borderColor: tintColor }]}>
              <ThemedText style={styles.emptyStateText}>
                No tienes permisos para acceder a ninguna sección del menú.
              </ThemedText>
            </View>
          ) : (
            visibleSections.map((section) => (
              <MenuButton
                key={section.key}
                icon={section.icon}
                title={section.title}
                subtitle={
                  section.items.length === 1
                    ? '1 opción disponible'
                    : `${section.items.length} opciones disponibles`
                }
                onPress={() =>
                  router.push({ pathname: '/menu/[section]', params: { section: section.key } })
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Menu;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sectionsContainer: {
    paddingBottom: 30,
  },
  emptyStateContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cccccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
