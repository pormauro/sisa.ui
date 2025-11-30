import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { findMenuSection, MenuItem } from '@/constants/menuSections';
import { MenuButton } from '@/components/MenuButton';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useContext } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileContext } from '@/contexts/ProfileContext';
import { useCompanyLogo } from '@/hooks/useCompanyLogo';

const MenuGroupScreen: React.FC = () => {
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const sectionKey = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam;
  const menuSection = findMenuSection(sectionKey);

  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const profileContext = useContext(ProfileContext);
  const profileDetails = profileContext?.profileDetails ?? null;
  const loadProfile = profileContext?.loadProfile;
  const avatarUri = useCompanyLogo(profileDetails?.profile_file_id ?? null);
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

  useFocusEffect(
    useCallback(() => {
      if (!profileDetails && loadProfile) {
        void loadProfile();
      }
    }, [profileDetails, loadProfile])
  );

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
              {visibleItems.map(({ item, access }) => {
                const isProfileItem = item.route === '/user/ProfileScreen';
                const customIcon =
                  isProfileItem && avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.profileAvatar} resizeMode="cover" />
                  ) : undefined;

                return (
                  <MenuButton
                    key={item.route}
                    icon={item.icon}
                    title={item.title}
                    layout="grid"
                    showChevron={false}
                    onPress={() => router.push(access.route as any)}
                    customIcon={customIcon}
                  />
                );
              })}
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
    columnGap: 12,
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
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  menuContainer: {
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
