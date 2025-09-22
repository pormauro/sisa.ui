import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
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
  const textColor = useThemeColor({}, 'text');
  const iconForegroundColor = useThemeColor({ light: '#FFFFFF', dark: '#2f273e' }, 'text');
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const cardBackgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#3d2f4d' }, 'background');

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
              <TouchableOpacity
                key={section.key}
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: cardBackgroundColor,
                    borderColor: tintColor,
                    shadowColor: isLightMode ? '#00000020' : '#00000080',
                  },
                ]}
                onPress={() => router.push({ pathname: '/menu/[section]', params: { section: section.key } })}
              >
                <View style={[styles.sectionIconContainer, { backgroundColor: tintColor }]}>
                  <Ionicons name={section.icon} size={32} color={iconForegroundColor} />
                </View>
                <View style={styles.sectionContent}>
                  <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                  <ThemedText style={styles.sectionSubtitle}>
                    {section.items.length === 1
                      ? '1 opción disponible'
                      : `${section.items.length} opciones disponibles`}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={24} color={textColor} />
              </TouchableOpacity>
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
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
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
