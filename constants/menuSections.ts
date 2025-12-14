import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface MenuItem {
  title: string;
  route: string;
  icon: IconName;
  requiredPermissions?: string[];
  fallbackPermissions?: string[];
  fallbackRoute?: string;
  superuserVisible?: boolean;
}

export type MenuSectionKey =
  | 'shortcuts'
  | 'financial'
  | 'commercial'
  | 'operations'
  | 'settings';

export interface MenuSection {
  key: MenuSectionKey;
  title: string;
  icon: IconName;
  items: MenuItem[];
}

export const SHORTCUTS_SECTION: MenuSection = {
  key: 'shortcuts',
  title: 'Atajos',
  icon: 'flash-outline',
  items: [
    {
      title: 'Planillas de pagos',
      route: '/shortcuts/payment_templates',
      icon: 'sparkles-outline',
      requiredPermissions: ['listPaymentTemplates', 'usePaymentTemplateShortcuts'],
    },
  ],
};

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
    key: 'settings',
    title: 'Configuración y perfil',
    icon: 'settings',
    items: [
      { title: 'Perfil', route: '/user/ProfileScreen', icon: 'person' },
      { title: 'Configuración', route: '/user/ConfigScreen', icon: 'settings' },
      {
        title: 'Permisos',
        route: '/permission',
        icon: 'lock-closed',
        requiredPermissions: ['listPermissions'],
        superuserVisible: true,
      },
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
        superuserVisible: true,
      },
    ],
  },
];

export const findMenuSection = (key: string | undefined) =>
  key === SHORTCUTS_SECTION.key
    ? SHORTCUTS_SECTION
    : MENU_SECTIONS.find((section) => section.key === key);
