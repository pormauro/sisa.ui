import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface MenuItem {
  title: string;
  route: string;
  icon: IconName;
  requiredPermissions?: string[];
  fallbackPermissions?: string[];
  fallbackRoute?: string;
}

export type MenuSectionKey = 'financial' | 'commercial' | 'operations' | 'tracking' | 'settings';

export interface MenuSection {
  key: MenuSectionKey;
  title: string;
  icon: IconName;
  items: MenuItem[];
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    key: 'financial',
    title: 'Gestión financiera',
    icon: 'cash-outline',
    items: [
      {
        title: 'Facturas',
        route: '/invoices',
        icon: 'document-text-outline',
        requiredPermissions: ['listInvoices'],
      },
      { title: 'Recibos', route: '/receipts', icon: 'receipt', requiredPermissions: ['listReceipts'] },
      { title: 'Pagos', route: '/payments', icon: 'card', requiredPermissions: ['listPayments'] },
      {
        title: 'Plantillas de pago',
        route: '/payment_templates',
        icon: 'sparkles-outline',
        requiredPermissions: ['listPaymentTemplates'],
      },
      {
        title: 'Cajas',
        route: '/cash_boxes',
        icon: 'cash-outline',
        requiredPermissions: ['listCashBoxes'],
      },
      {
        title: 'Resumen contable',
        route: '/accounting/summary',
        icon: 'stats-chart-outline',
        requiredPermissions: ['viewAccountingSummary'],
      },
      {
        title: 'Cuentas contables',
        route: '/accounts',
        icon: 'wallet-outline',
        requiredPermissions: ['listAccounts'],
        fallbackPermissions: ['addAccount'],
        fallbackRoute: '/accounts/create',
      },
      {
        title: 'Transferencias',
        route: '/transfers',
        icon: 'swap-horizontal-outline',
        requiredPermissions: ['addTransfer'],
        fallbackPermissions: ['listAccountingEntries'],
      },
      {
        title: 'Libro diario',
        route: '/journal_entries',
        icon: 'reader-outline',
        requiredPermissions: ['listAccountingEntries'],
      },
      {
        title: 'Cierres',
        route: '/closings',
        icon: 'checkmark-done-outline',
        requiredPermissions: ['listClosings'],
        fallbackPermissions: ['addClosing'],
      },
      {
        title: 'Categorías contables',
        route: '/categories',
        icon: 'list',
        requiredPermissions: ['listCategories'],
      },
      {
        title: 'Reportes',
        route: '/reports',
        icon: 'document-attach-outline',
        requiredPermissions: ['generatePaymentReport'],
        fallbackPermissions: ['listReports'],
      },
    ],
  },
  {
    key: 'commercial',
    title: 'Catálogos comerciales',
    icon: 'pricetags',
    items: [
      {
        title: 'Empresas',
        route: '/companies',
        icon: 'business',
        requiredPermissions: ['listCompanies'],
      },
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
    key: 'operations',
    title: 'Operaciones',
    icon: 'briefcase',
    items: [
      { title: 'Trabajos', route: '/jobs', icon: 'briefcase', requiredPermissions: ['listJobs'] },
      { title: 'Agenda', route: '/appointments', icon: 'calendar', requiredPermissions: ['listAppointments'] },
      { title: 'Carpetas', route: '/folders', icon: 'folder', requiredPermissions: ['listFolders'] },
      { title: 'Estados', route: '/statuses', icon: 'flag', requiredPermissions: ['listStatuses'] },
    ],
  },
  {
    key: 'tracking',
    title: 'Tracking y cercania',
    icon: 'navigate-circle-outline',
    items: [
      {
        title: 'Cola de puntos',
        route: '/tracking/queue',
        icon: 'git-compare-outline',
        requiredPermissions: ['getTrackingStatus'],
        fallbackPermissions: ['getTrackingPolicy', 'uploadTrackingPoints'],
      },
      {
        title: 'Config. GPS',
        route: '/tracking/gps-config',
        icon: 'options-outline',
        requiredPermissions: ['getTrackingPolicy'],
        fallbackPermissions: ['getTrackingStatus'],
      },
      {
        title: 'Clientes cercanos',
        route: '/tracking/nearby-clients',
        icon: 'location-outline',
        requiredPermissions: ['listNearbyClients'],
      },
    ],
  },
  {
    key: 'settings',
    title: 'Configuración y perfil',
    icon: 'settings',
    items: [
      { title: 'Perfil', route: '/user/ProfileScreen', icon: 'person' },
      { title: 'Configuración', route: '/user/ConfigScreen', icon: 'settings' },
      { title: 'Permisos', route: '/permission', icon: 'lock-closed', requiredPermissions: ['listPermissions'] },
      {
        title: 'Notificaciones',
        route: '/notifications',
        icon: 'notifications-outline',
        requiredPermissions: ['listNotifications'],
      },
      {
        title: 'Registro de red',
        route: '/network/logs',
        icon: 'git-network-outline',
        requiredPermissions: ['listNetworkLogs'],
      },
      {
        title: 'Depurador de Share',
        route: '/share/debug',
        icon: 'share-social-outline',
      },
    ],
  },
];

export const findMenuSection = (key: string | undefined) =>
  MENU_SECTIONS.find((section) => section.key === key);
