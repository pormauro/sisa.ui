import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { MenuButton } from '@/components/MenuButton';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { MENU_SECTIONS, MenuItem } from '@/constants/menuSections';

const Menu: React.FC = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  // Función para determinar si se deben mostrar los elementos con permisos requeridos.
  const isEnabled = (item: MenuItem): boolean => {
    // El botón de permisos siempre está disponible para el usuario maestro.
    if (item.route === '/permission' && userId === '1') return true;
    // Si no hay permisos requeridos, se muestra.
    if (!item.requiredPermissions) return true;
    // De lo contrario, se verifica que el usuario tenga todos los permisos requeridos.
    return item.requiredPermissions.every((perm) => permissions.includes(perm));
  };

  const visibleSections = MENU_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter(isEnabled),
    }))
    .filter((section) => section.items.length > 0);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ScrollView style={{ backgroundColor }} contentContainerStyle={styles.container}>
        <ThemedText style={styles.title}>Menú Principal</ThemedText>
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
    marginBottom: 20,
    textAlign: 'center',
  },
});
