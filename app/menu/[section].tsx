import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { findMenuSection, MenuItem } from '@/constants/menuSections';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const MenuGroupScreen: React.FC = () => {
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const sectionKey = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam;
  const menuSection = findMenuSection(sectionKey);

  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);
  const router = useRouter();

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const iconForegroundColor = useThemeColor({ light: '#FFFFFF', dark: '#2f273e' }, 'text');
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const menuContentColor = isLightMode ? '#FFFFFF' : textColor;

  const isEnabled = (item: MenuItem): boolean => {
    if (item.route === '/permission' && userId === '1') return true;
    if (!item.requiredPermissions) return true;
    return item.requiredPermissions.every((perm) => permissions.includes(perm));
  };

  const visibleItems = menuSection ? menuSection.items.filter(isEnabled) : [];

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
              {visibleItems.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.menuItem, { backgroundColor: tintColor }]}
                  onPress={() => router.push(item.route as any)}
                >
                  <Ionicons
                    name={item.icon}
                    size={40}
                    color={menuContentColor}
                    style={styles.menuIcon}
                  />
                  <ThemedText lightColor={isLightMode ? '#FFFFFF' : undefined} style={styles.menuText}>
                    {item.title}
                  </ThemedText>
                </TouchableOpacity>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '48%',
    alignItems: 'center',
  },
  menuIcon: {
    marginBottom: 8,
  },
  menuText: {
    fontSize: 18,
    textAlign: 'center',
    width: '100%',
    flexShrink: 1,
    lineHeight: 24,
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
