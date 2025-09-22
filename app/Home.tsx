import { AuthContext } from '@/contexts/AuthContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useRouter } from 'expo-router';
import React, { useContext, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { Collapsible } from '@/components/Collapsible';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';

type IconName = keyof typeof Ionicons.glyphMap;

interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  route?: string;
  enabled: boolean;
  requiredPermissions?: string[];
  submenu?: MenuItem[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'Accesos rápidos',
    items: [
      {
        key: 'recibos',
        label: 'Recibos',
        icon: 'receipt',
        enabled: true,
        route: '/receipts',
        requiredPermissions: ['listReceipts'],
      },
      {
        key: 'pagos',
        label: 'Pagos',
        icon: 'wallet',
        enabled: true,
        route: '/payments',
        requiredPermissions: ['listPayments'],
      },
      {
        key: 'clientes',
        label: 'Clientes',
        icon: 'people',
        enabled: true,
        route: '/clients',
        requiredPermissions: ['listClients'],
      },
      {
        key: 'proveedores',
        label: 'Proveedores',
        icon: 'cart',
        enabled: true,
        route: '/providers',
        requiredPermissions: ['listProviders'],
      },
      {
        key: 'trabajos',
        label: 'Trabajos',
        icon: 'briefcase',
        enabled: true,
        route: '/jobs',
        requiredPermissions: ['listJobs'],
      },
      {
        key: 'agenda',
        label: 'Agenda',
        icon: 'calendar',
        enabled: true,
        route: '/appointments',
        requiredPermissions: ['listAppointments'],
      },
      {
        key: 'tarifas',
        label: 'Tarifas',
        icon: 'pricetag',
        enabled: true,
        route: '/tariffs',
        requiredPermissions: ['listTariffs'],
      },
      {
        key: 'carpetas',
        label: 'Carpetas',
        icon: 'folder',
        enabled: true,
        route: '/folders',
        requiredPermissions: ['listFolders'],
      },
      {
        key: 'cajas',
        label: 'Cajas',
        icon: 'cash',
        enabled: true,
        route: '/cash_boxes',
        requiredPermissions: ['listCashBoxes'],
      },
      {
        key: 'categorias',
        label: 'Categorías',
        icon: 'list',
        enabled: true,
        route: '/categories',
        requiredPermissions: ['listCategories'],
      },
      {
        key: 'estados',
        label: 'Estados',
        icon: 'flag',
        enabled: true,
        route: '/statuses',
        requiredPermissions: ['listStatuses'],
      },
      {
        key: 'perfil',
        label: 'Perfil',
        icon: 'person',
        enabled: true,
        route: '/user/ProfileScreen',
      },
      {
        key: 'configuracion',
        label: 'Configuración',
        icon: 'settings',
        enabled: true,
        route: '/user/ConfigScreen',
      },
      {
        key: 'permisos',
        label: 'Permisos',
        icon: 'lock-closed',
        enabled: true,
        route: '/permission',
        requiredPermissions: ['listPermissions'],
      },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { key: 'ventas_presupuestos', label: 'Presupuestos', icon: 'document-text', enabled: false },
      { key: 'ventas_facturacion', label: 'Facturas', icon: 'file-tray-full', enabled: false },
      { key: 'ventas_remitos', label: 'Remitos', icon: 'cube', enabled: false },
      { key: 'ventas_nc', label: 'Notas de Crédito', icon: 'receipt-outline', enabled: false },
      { key: 'ventas_nd', label: 'Notas de Débito', icon: 'receipt-outline', enabled: false },
      { key: 'ventas_cobranzas', label: 'Cobranzas', icon: 'cash-outline', enabled: false },
      {
        key: 'ventas_mas',
        label: 'Más…',
        icon: 'ellipsis-horizontal-circle',
        enabled: true,
        submenu: [
          { key: 'ventas_clientesPot', label: 'Clientes Potenciales (CRM)', icon: 'sparkles', enabled: false },
          { key: 'ventas_listas', label: 'Listas de Precios', icon: 'pricetags', enabled: false },
          { key: 'ventas_contratos', label: 'Contratos', icon: 'document-attach', enabled: false },
          { key: 'ventas_garantias', label: 'Garantías', icon: 'shield-checkmark', enabled: false },
        ],
      },
    ],
  },
  {
    title: 'Compras',
    items: [
      { key: 'compras_oc', label: 'Órdenes de Compra', icon: 'bag-add', enabled: false },
      { key: 'compras_facturas', label: 'Facturas', icon: 'file-tray', enabled: false },
      { key: 'compras_ndc', label: 'Notas de Crédito', icon: 'receipt-outline', enabled: false },
      { key: 'compras_pagos', label: 'Pagos', icon: 'card', enabled: false },
      { key: 'compras_proveedores', label: 'Altas de Proveedor', icon: 'person-add', enabled: false },
    ],
  },
  {
    title: 'Stock',
    items: [
      { key: 'stock_productos', label: 'Productos/Servicios', icon: 'construct', enabled: false },
      { key: 'stock_inventario', label: 'Inventario', icon: 'clipboard', enabled: false },
      { key: 'stock_movimientos', label: 'Movimientos', icon: 'swap-vertical', enabled: false },
      { key: 'stock_depositos', label: 'Depósitos', icon: 'business', enabled: false },
      { key: 'stock_kits', label: 'Kits/Combos', icon: 'git-merge', enabled: false },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { key: 'finanzas_bancos', label: 'Bancos', icon: 'business-outline', enabled: false },
      { key: 'finanzas_conciliacion', label: 'Conciliación', icon: 'repeat', enabled: false },
      { key: 'finanzas_tesoreria', label: 'Tesorería', icon: 'cash', enabled: false },
      { key: 'finanzas_cheques', label: 'Cheques', icon: 'ticket', enabled: false },
      { key: 'finanzas_transferencias', label: 'Transferencias', icon: 'swap-horizontal', enabled: false },
      { key: 'finanzas_arqueo', label: 'Arqueo de Caja', icon: 'calculator', enabled: false },
    ],
  },
  {
    title: 'Contabilidad',
    items: [
      { key: 'conta_asientos', label: 'Asientos', icon: 'create', enabled: false },
      { key: 'conta_diario', label: 'Libro Diario', icon: 'book', enabled: false },
      { key: 'conta_mayor', label: 'Libro Mayor', icon: 'library', enabled: false },
      { key: 'conta_balances', label: 'Balances', icon: 'stats-chart', enabled: false },
      {
        key: 'conta_reportes',
        label: 'Reportes',
        icon: 'bar-chart',
        enabled: true,
        submenu: [
          { key: 'rep_resumen', label: 'Resumen Financiero', icon: 'analytics', enabled: false },
          { key: 'rep_resultados', label: 'Estado de Resultados', icon: 'trending-up', enabled: false },
          { key: 'rep_flujo', label: 'Flujo de Fondos', icon: 'water', enabled: false },
        ],
      },
    ],
  },
  {
    title: 'AFIP e Impuestos',
    items: [
      { key: 'afip_fe', label: 'Facturación Electrónica', icon: 'cloud-upload', enabled: false },
      { key: 'afip_cae', label: 'CAE', icon: 'key', enabled: false },
      { key: 'impuestos_ret', label: 'Ret./Perc.', icon: 'filter', enabled: false },
      { key: 'impuestos_sicore', label: 'SICORE/ARBA', icon: 'server', enabled: false },
    ],
  },
  {
    title: 'Técnico',
    items: [
      { key: 'tec_tareas', label: 'Tareas', icon: 'checkmark-done', enabled: false },
      { key: 'tec_tickets', label: 'Tickets/Soporte', icon: 'help-buoy', enabled: false },
      { key: 'tec_rondas', label: 'Rondas/Manten.', icon: 'cog', enabled: false },
      { key: 'tec_vehiculos', label: 'Vehículos', icon: 'car', enabled: false },
      { key: 'tec_herramientas', label: 'Herramientas', icon: 'hammer', enabled: false },
      { key: 'tec_insumos', label: 'Insumos', icon: 'color-fill', enabled: false },
    ],
  },
  {
    title: 'Administración',
    items: [
      { key: 'admin_sucursales', label: 'Sucursales', icon: 'pin', enabled: false },
      { key: 'admin_ubicaciones', label: 'Ubicaciones', icon: 'navigate', enabled: false },
      { key: 'admin_monedas', label: 'Monedas', icon: 'cash-outline', enabled: false },
      {
        key: 'admin_usuarios',
        label: 'Usuarios',
        icon: 'people-circle',
        enabled: true,
        submenu: [
          { key: 'admin_roles', label: 'Roles', icon: 'shield', enabled: false },
          { key: 'admin_auditoria', label: 'Auditoría', icon: 'search', enabled: false },
          { key: 'admin_notif', label: 'Notificaciones', icon: 'notifications', enabled: false },
          { key: 'admin_integraciones', label: 'Integraciones/API', icon: 'link', enabled: false },
        ],
      },
    ],
  },
];

const Menu: React.FC = () => {
  const router = useRouter();
  const { userId } = useContext(AuthContext);
  const { permissions } = useContext(PermissionsContext);

  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());

  const toggleExpansion = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const visibleSections = useMemo(() => {
    const userHasPermissions = (item: MenuItem): boolean => {
      if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
        return true;
      }
      if (item.route === '/permission' && userId === '1') {
        return true;
      }
      return item.requiredPermissions.every((perm) => permissions.includes(perm));
    };

    const filterMenuItem = (item: MenuItem): MenuItem | null => {
      const filteredSubmenu = item.submenu
        ?.map((submenuItem) => filterMenuItem(submenuItem))
        .filter((submenuItem): submenuItem is MenuItem => submenuItem !== null);

      const hasVisibleChildren = filteredSubmenu && filteredSubmenu.length > 0;

      if (item.enabled && !userHasPermissions(item) && !hasVisibleChildren) {
        return null;
      }

      return {
        ...item,
        submenu: filteredSubmenu,
      };
    };

    return MENU_SECTIONS.map((section) => {
      const visibleItems = section.items
        .map((item) => filterMenuItem(item))
        .filter((item): item is MenuItem => item !== null);

      return {
        ...section,
        items: visibleItems,
      };
    }).filter((section) => section.items.length > 0);
  }, [permissions, userId]);

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

  const renderMenuItem = (item: MenuItem, level = 0): JSX.Element => {
    const isSubItem = level > 0;
    const hasSubmenu = Boolean(item.submenu && item.submenu.length > 0);
    const isExpanded = expandedItems.has(item.key);
    const isItemDisabled = !item.enabled;
    const iconColor = isItemDisabled ? disabledTextColor : isLightMode ? menuContentColor : textColor;
    const titleLightColor = isItemDisabled ? disabledTextColor : isLightMode ? menuContentColor : undefined;
    const titleDarkColor = isItemDisabled ? disabledTextColor : undefined;
    const iconSize = isSubItem ? 32 : 40;

    const wrapperStyles = [
      level === 0 ? styles.menuItemWrapper : styles.submenuItemWrapper,
      hasSubmenu && styles.menuItemWrapperFullWidth,
    ];

    return (
      <View key={item.key} style={wrapperStyles}>
        <TouchableOpacity
          style={[
            styles.menuItem,
            isSubItem && styles.submenuItem,
            {
              backgroundColor: isItemDisabled ? disabledBackgroundColor : tintColor,
              borderColor: isItemDisabled ? disabledBorderColor : 'transparent',
              borderWidth: isItemDisabled ? 1 : 0,
            },
            isItemDisabled && styles.menuItemDisabled,
          ]}
          disabled={isItemDisabled}
          onPress={() => {
            if (!isItemDisabled && item.route) {
              router.push(item.route as any);
            }
            if (hasSubmenu) {
              toggleExpansion(item.key);
            }
          }}
        >
          <Ionicons
            name={item.icon}
            size={iconSize}
            color={iconColor}
            style={[styles.menuIcon, isSubItem && styles.submenuIcon]}
          />
          <ThemedText
            lightColor={titleLightColor}
            darkColor={titleDarkColor}
            style={[styles.menuText, isSubItem && styles.submenuText]}
          >
            {item.label}
          </ThemedText>
          {hasSubmenu ? (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={iconColor}
              style={styles.submenuIndicator}
            />
          ) : null}
        </TouchableOpacity>
        {hasSubmenu && isExpanded ? (
          <View style={styles.submenuItemsContainer}>
            {item.submenu!.map((subItem) => renderMenuItem(subItem, level + 1))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: menuBackgroundColor }]}>
      <ScrollView style={{ backgroundColor: menuBackgroundColor }} contentContainerStyle={styles.container}>
        <ThemedText style={styles.title}>Menú Principal</ThemedText>
        <View style={styles.sectionsContainer}>
          {visibleSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Collapsible title={section.title}>
                <View style={styles.menuContainer}>
                  {section.items.map((item) => renderMenuItem(item))}
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
  menuItemWrapper: {
    width: '48%',
  },
  menuItemWrapperFullWidth: {
    width: '100%',
  },
  submenuItemWrapper: {
    width: '48%',
  },
  submenuItemsContainer: {
    marginTop: 10,
    width: '100%',
    paddingLeft: 12,
    paddingRight: 12,
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
    alignItems: 'center',
    position: 'relative',
  },
  submenuItem: {
    paddingVertical: 12,
  },
  menuIcon: {
    marginBottom: 5,
  },
  submenuIcon: {
    marginBottom: 5,
  },
  menuText: {
    fontSize: 18,
    textAlign: 'center',
  },
  submenuText: {
    fontSize: 16,
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  submenuIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});
