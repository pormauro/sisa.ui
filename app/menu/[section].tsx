import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { findMenuSection, MenuItem } from '@/constants/menuSections';
import { MenuButton } from '@/components/MenuButton';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MenuGroupScreen: React.FC = () => {
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const sectionKey = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam;
  const menuSection = findMenuSection(sectionKey);

  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const iconForegroundColor = useThemeColor({ light: '#FFFFFF', dark: '#2f273e' }, 'text');

  const resolveAccess = (item: MenuItem): { enabled: boolean; route: string } => {
    if (item.route === '/permission' && userId === '1') {
      return { enabled: true, route: item.route };
    }

    if (!item.requiredPermissions) {
      return { enabled: true, route: item.route };
    }

    const hasRequired = item.requiredPermissions.every(perm => permissions.includes(perm));
    if (hasRequired) {
      return { enabled: true, route: item.route };
    }

    if (item.fallbackPermissions?.some(perm => permissions.includes(perm))) {
      return {
        enabled: true,
        route: item.fallbackRoute ?? item.route,
      };
    }

    return { enabled: false, route: item.route };
  };

  const visibleItems = menuSection
    ? menuSection.items
        .map(item => ({ item, access: resolveAccess(item) }))
        .filter(entry => entry.access.enabled)
    : [];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { borderColor: tintColor }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={tintColor} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            {menuSection && (
              <View style={[styles.sectionIconContainer, { backgroundColor: tintColor }]}>
                <Ionicons name={menuSection.icon} size={28} color={iconForegroundColor} />
              </View>
            )}
            <ThemedText style={styles.headerTitle}>{menuSection?.title ?? 'Menú'}</ThemedText>
          </View>
        </View>

        {menuSection ? (
          visibleItems.length > 0 ? (
            <View style={styles.menuContainer}>
              {visibleItems.map(({ item, access }) => (
                <MenuButton
                  key={item.route}
                  icon={item.icon}
                  title={item.title}
                  onPress={() => router.push(access.route as any)}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyStateContainer, { borderColor: tintColor }]}>
              <ThemedText style={styles.emptyStateText}>
                No tienes permisos para acceder a estas opciones.
              </ThemedText>
            </View>
          )
        ) : (
          <View style={[styles.emptyStateContainer, { borderColor: tintColor }]}>
            <ThemedText style={styles.emptyStateText}>
              La sección seleccionada no está disponible.
            </ThemedText>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: tintColor }]}
              onPress={() => router.replace('/Home')}
            >
              <ThemedText lightColor="#FFFFFF" style={styles.primaryButtonText}>
                Volver al menú principal
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MenuGroupScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    flexShrink: 1,
    lineHeight: 30,
  },
  sectionIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContainer: {
    paddingBottom: 8,
  },
  emptyStateContainer: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
