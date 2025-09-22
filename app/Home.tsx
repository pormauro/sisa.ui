import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { Collapsible } from '@/components/Collapsible';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';

interface MenuItem {
  title: string;
  route?: string;
  icon: keyof typeof Ionicons.glyphMap;
  // Si no se especifica, se asume que la sección siempre está habilitada.
  requiredPermissions?: string[];
  disabled?: boolean;
  comingSoon?: boolean;
  disabledIcon?: keyof typeof Ionicons.glyphMap;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: 'Gestión financiera',
    items: [
      { title: 'Recibos', route: '/receipts', icon: 'receipt', requiredPermissions: ['listReceipts'] },
      { title: 'Pagos', route: '/payments', icon: 'card', requiredPermissions: ['listPayments'] },
      {
        title: 'Cajas',
        route: '/cash_boxes',
        icon: 'cash-outline',
        requiredPermissions: ['listCashBoxes'],
      },
      { title: 'Categorías contables', route: '/categories', icon: 'list', requiredPermissions: ['listCategories'] },
      {
        title: 'Facturación',
        icon: 'document-text',
        disabled: true,
        comingSoon: true,
        disabledIcon: 'hourglass-outline',
      },
      {
        title: 'Bancos',
        icon: 'business',
        disabled: true,
        comingSoon: true,
        disabledIcon: 'time-outline',
      },
      {
        title: 'Presupuestos',
        icon: 'calculator',
        disabled: true,
        comingSoon: true,
        disabledIcon: 'calculator-outline',
      },
      {
        title: 'Impuestos',
        icon: 'receipt-outline',
        disabled: true,
        comingSoon: true,
        disabledIcon: 'time-outline',
      },
      {
        title: 'Reportes',
        icon: 'bar-chart',
        disabled: true,
        comingSoon: true,
        disabledIcon: 'stats-chart-outline',
      },
    ],
  },
  {
    title: 'Catálogos comerciales',
    items: [
      { title: 'Clientes', route: '/clients', icon: 'people', requiredPermissions: ['listClients'] },
      { title: 'Proveedores', route: '/providers', icon: 'cart', requiredPermissions: ['listProviders'] },
      {
        title: 'Productos y servicios',
        route: '/products_services',
        icon: 'pricetags',
        requiredPermissions: ['listProductsServices'],
      },
      { title: 'Tarifas', route: '/tariffs', icon: 'pricetag', requiredPermissions: ['listTariffs'] },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { title: 'Trabajos', route: '/jobs', icon: 'briefcase', requiredPermissions: ['listJobs'] },
      { title: 'Agenda', route: '/appointments', icon: 'calendar', requiredPermissions: ['listAppointments'] },
      { title: 'Carpetas', route: '/folders', icon: 'folder', requiredPermissions: ['listFolders'] },
      { title: 'Estados', route: '/statuses', icon: 'flag', requiredPermissions: ['listStatuses'] },
      {
        title: 'Inventario',
        icon: 'cube',
        disabled: true,
        comingSoon: true,
        disabledIcon: 'cube-outline',
      },
      {
        title: 'RR.HH.',
        icon: 'people-circle',
        disabled: true,
        comingSoon: true,
        disabledIcon: 'people-circle-outline',
      },
      {
        title: 'Activos Fijos',
        icon: 'build',
        disabled: true,
        comingSoon: true,
        disabledIcon: 'build-outline',
      },
    ],
  },
  {
    title: 'Configuración y perfil',
    items: [
      { title: 'Perfil', route: '/user/ProfileScreen', icon: 'person' },
      { title: 'Configuración', route: '/user/ConfigScreen', icon: 'settings' },
      { title: 'Permisos', route: '/permission', icon: 'lock-closed', requiredPermissions: ['listPermissions'] },
    ],
  },
];

const Menu: React.FC = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  // Función para determinar si se deben mostrar los elementos con permisos requeridos.
  const isEnabled = (item: MenuItem): boolean => {
    if (item.disabled) return true;
    // El botón de permisos siempre está disponible para el usuario maestro.
    if (item.route === '/permission' && userId === '1') return true;
    // Si no hay permisos requeridos, se muestra.
    if (!item.requiredPermissions || item.requiredPermissions.length === 0) return true;
    // De lo contrario, se verifica que el usuario tenga todos los permisos requeridos.
    return item.requiredPermissions.every((perm) => permissions.includes(perm));
  };

  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter(isEnabled),
    }))
    .filter((section) => section.items.length > 0);

  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const menuBackgroundColor = isLightMode ? '#FFFFFF' : backgroundColor;
  const menuContentColor = isLightMode ? '#FFFFFF' : textColor;
  const disabledBackgroundColor = isLightMode ? '#F4F4F5' : '#1F2937';
  const disabledBorderColor = isLightMode ? '#E5E7EB' : '#374151';
  const disabledTextColor = isLightMode ? '#6B7280' : '#9CA3AF';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: menuBackgroundColor }]}> 
      <ScrollView style={{ backgroundColor: menuBackgroundColor }} contentContainerStyle={styles.container}>
        <ThemedText style={styles.title}>Menú Principal</ThemedText>
        <View style={styles.sectionsContainer}>
          {visibleSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Collapsible title={section.title}>
                <View style={styles.menuContainer}>
                  {section.items.map((item) => {
                    const isItemDisabled = item.disabled ?? false;
                    const iconName = isItemDisabled && item.disabledIcon ? item.disabledIcon : item.icon;
                    const iconColor = isItemDisabled
                      ? disabledTextColor
                      : isLightMode
                        ? menuContentColor
                        : textColor;
                    const titleLightColor = isItemDisabled
                      ? disabledTextColor
                      : isLightMode
                        ? menuContentColor
                        : undefined;
                    const titleDarkColor = isItemDisabled ? disabledTextColor : undefined;
                    const helperText = item.comingSoon
                      ? 'Disponible próximamente'
                      : item.disabled
                        ? 'No disponible'
                        : undefined;

                    return (
                      <TouchableOpacity
                        key={`${section.title}-${item.title}`}
                        style={[
                          styles.menuItem,
                          { backgroundColor: tintColor },
                          isItemDisabled && styles.menuItemDisabled,
                          isItemDisabled && {
                            backgroundColor: disabledBackgroundColor,
                            borderColor: disabledBorderColor,
                            borderWidth: 1,
                          },
                        ]}
                        disabled={isItemDisabled}
                        onPress={() => {
                          if (!isItemDisabled && item.route) {
                            router.push(item.route as any);
                          }
                        }}
                      >
                        <Ionicons
                          name={iconName}
                          size={40}
                          color={iconColor}
                          style={styles.menuIcon}
                        />
                        <ThemedText
                          lightColor={titleLightColor}
                          darkColor={titleDarkColor}
                          style={styles.menuText}
                        >
                          {item.title}
                        </ThemedText>
                        {helperText ? (
                          <ThemedText
                            lightColor={disabledTextColor}
                            darkColor={disabledTextColor}
                            style={styles.menuHelperText}
                          >
                            {helperText}
                          </ThemedText>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Collapsible>
            </View>
          ))}
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
  section: {
    marginBottom: 20,
  },
  menuContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
    width: '48%',
    flexDirection: 'column',
    alignItems: 'center',
  },
  menuIcon: {
    marginBottom: 5,
  },
  menuText: {
    fontSize: 18,
    textAlign: 'center',
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuHelperText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
});
