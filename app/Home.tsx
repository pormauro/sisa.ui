import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useContext } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/MenuButton';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { MENU_SECTIONS, MenuItem } from '@/constants/menuSections';
import { AppUpdatesContext } from '@/contexts/AppUpdatesContext';

const Menu: React.FC = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const { latestUpdate, updateAvailable, refreshLatestUpdate, currentVersion } = useContext(AppUpdatesContext);

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

  const visibleSections = MENU_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(isEnabled),
  })).filter((section) => section.items.length > 0);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const shouldShowUpdateButton =
    permissions.includes('listAppUpdates') && updateAvailable && Boolean(latestUpdate);

  useFocusEffect(
    useCallback(() => {
      if (permissions.includes('listAppUpdates')) {
        void refreshLatestUpdate();
      }
    }, [permissions, refreshLatestUpdate])
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}> 
      <View style={styles.contentWrapper}>
        <ScrollView style={{ backgroundColor }} contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Menú Principal</ThemedText>
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
      </View>
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
    paddingBottom: 80,
  },
  contentWrapper: {
    flex: 1,
  },
  updateContainer: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 20,
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'left',
  },
});
