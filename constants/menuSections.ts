import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface MenuItem {
  title: string;
  route: string;
  icon: IconName;
  requiredPermissions?: string[];
}

export type MenuSectionKey =
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

export const MENU_SECTIONS: MenuSection[] = [
  {
    key: 'financial',
    title: 'Gestión financiera',
    icon: 'cash-outline',
    items: [
      {
        title: 'Facturación',
        route: '/invoices',
        icon: 'document-text-outline',
        requiredPermissions: ['listInvoices'],
      },
      { title: 'Recibos', route: '/receipts', icon: 'receipt', requiredPermissions: ['listReceipts'] },
      { title: 'Pagos', route: '/payments', icon: 'card', requiredPermissions: ['listPayments'] },
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
    ],
  },
  {
    key: 'commercial',
    title: 'Catálogos comerciales',
    icon: 'pricetags',
    items: [
      { title: 'Empresas', route: '/companies', icon: 'business', requiredPermissions: ['listCompanies'] },
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
      { title: 'Permisos', route: '/permission', icon: 'lock-closed', requiredPermissions: ['listPermissions'] },
      {
        title: 'Comentarios',
        route: '/comments',
        icon: 'chatbubbles',
        requiredPermissions: ['listComments'],
      },
    ],
  },
];

export const findMenuSection = (key: string | undefined) =>
  MENU_SECTIONS.find((section) => section.key === key);
