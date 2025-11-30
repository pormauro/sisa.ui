import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useContext, useMemo } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { MenuButton } from '@/components/MenuButton';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { MENU_SECTIONS, MenuItem } from '@/constants/menuSections';
import { AppUpdatesContext } from '@/contexts/AppUpdatesContext';
import { ProfileContext } from '@/contexts/ProfileContext';
import { useCompanyLogo } from '@/hooks/useCompanyLogo';

const Menu: React.FC = () => {
  const router = useRouter();
  const { userId, username } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { latestUpdate, updateAvailable, refreshLatestUpdate, currentVersion } = useContext(AppUpdatesContext);
  const profileContext = useContext(ProfileContext);
  const profileDetails = profileContext?.profileDetails ?? null;
  const loadProfile = profileContext?.loadProfile;
  const profileImageUri = useCompanyLogo(profileDetails?.profile_file_id ?? null);

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

  const handleUpdatePress = useCallback(async () => {
    if (!latestUpdate?.download_url) {
      Alert.alert('Descarga no disponible', 'No encontramos el enlace de actualización.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(latestUpdate.download_url);
      if (!supported) {
        Alert.alert('Descarga no disponible', 'No pudimos abrir el enlace de actualización.');
        return;
      }
      await Linking.openURL(latestUpdate.download_url);
    } catch (error) {
      console.log('No fue posible abrir el enlace de descarga.', error);
      Alert.alert('Error', 'Ocurrió un problema al abrir el enlace de descarga.');
    }
  }, [latestUpdate]);

  const visibleSections = [
    ...MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(isEnabled),
    })).filter((section) => section.items.length > 0),
  ];

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const heroBackground = useThemeColor({ light: '#ffd54f', dark: '#2d2635' }, 'background');
  const heroForeground = useThemeColor({ light: '#1f1b2d', dark: '#f8fafc' }, 'text');
  const heroControlBackground = useThemeColor({ light: '#ffffff', dark: 'rgba(255,255,255,0.16)' }, 'background');
  const shouldShowUpdateButton =
    permissions.includes('listAppUpdates') && updateAvailable && Boolean(latestUpdate);

  const greetingName = useMemo(() => {
    if (profileDetails?.full_name) {
      const [firstName] = profileDetails.full_name.split(/\s+/).filter(Boolean);
      if (firstName) return firstName;
    }
    return username ?? '';
  }, [profileDetails?.full_name, username]);

  useFocusEffect(
    useCallback(() => {
      if (permissions.includes('listAppUpdates')) {
        void refreshLatestUpdate();
      }
    }, [permissions, refreshLatestUpdate])
  );

  useFocusEffect(
    useCallback(() => {
      if (!profileDetails && loadProfile) {
        void loadProfile();
      }
    }, [profileDetails, loadProfile])
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ScrollView style={{ backgroundColor }} contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <View style={styles.heroHeader}>
            <TouchableOpacity
              style={styles.heroUser}
              onPress={() => router.push('/user/ProfileScreen')}
              accessibilityRole="button"
              accessibilityLabel="Abrir configuración de perfil"
            >
              <View
                style={[
                  styles.avatar,
                  {
                    borderColor: heroForeground,
                    backgroundColor: heroControlBackground,
                  },
                ]}
              >
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person-circle-outline" size={30} color={heroForeground} />
                )}
              </View>
              <View style={styles.heroTextGroup}>
                <ThemedText style={[styles.heroGreeting, { color: heroForeground }]}>Hola{greetingName ? `, ${greetingName}` : ''}</ThemedText>
                <ThemedText style={[styles.heroSubtitle, { color: heroForeground }]}>
                  Centraliza tus cobros, ventas y reportes
                </ThemedText>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsButton,
                { borderColor: heroForeground, backgroundColor: heroControlBackground },
              ]}
              onPress={() => router.push('/user/ConfigScreen')}
              accessibilityRole="button"
              accessibilityLabel="Abrir configuración de usuario"
            >
              <Ionicons name="settings-outline" size={20} color={heroForeground} />
            </TouchableOpacity>
          </View>
        </View>
        {shouldShowUpdateButton && latestUpdate ? (
          <View style={styles.updateContainer}>
            <MenuButton
              icon="download-outline"
              title={`Actualizar aplicación a la versión ${latestUpdate.version_code}`}
              subtitle={`Versión instalada ${currentVersion}`}
              showChevron={false}
              onPress={handleUpdatePress}
            />
          </View>
        ) : null}
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
                showChevron={false}
                layout="grid"
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
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 18,
  },
  updateContainer: {
    marginBottom: 8,
  },
  hero: {
    borderRadius: 18,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 4,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroTextGroup: {
    gap: 4,
    flex: 1,
  },
  heroGreeting: {
    fontSize: 16,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 14,
    opacity: 0.85,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  sectionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
});
