import { IconName } from './menuSections';

export interface PaymentTemplateIconOption {
  value: string;
  icon: IconName;
  label: string;
  keywords?: string[];
}

export const PAYMENT_TEMPLATE_ICON_OPTIONS: PaymentTemplateIconOption[] = [
  {
    value: 'sparkles-outline',
    icon: 'sparkles-outline',
    label: 'Predeterminado',
    keywords: ['default', 'general', 'plantilla'],
  },
  {
    value: 'card',
    icon: 'card',
    label: 'Tarjeta',
    keywords: ['tarjeta', 'crédito', 'debito', 'pago'],
  },
  {
    value: 'cash-outline',
    icon: 'cash-outline',
    label: 'Efectivo',
    keywords: ['efectivo', 'dinero', 'caja'],
  },
  {
    value: 'pricetag',
    icon: 'pricetag',
    label: 'Etiqueta',
    keywords: ['precio', 'insumos', 'venta'],
  },
  {
    value: 'pricetags',
    icon: 'pricetags',
    label: 'Etiquetas',
    keywords: ['precios', 'productos', 'servicios'],
  },
  {
    value: 'receipt',
    icon: 'receipt',
    label: 'Recibo',
    keywords: ['ticket', 'factura', 'comprobante'],
  },
  {
    value: 'fast-food-outline',
    icon: 'fast-food-outline',
    label: 'Comida rápida',
    keywords: ['comida', 'viáticos', 'alimentación'],
  },
  {
    value: 'restaurant-outline',
    icon: 'restaurant-outline',
    label: 'Restaurante',
    keywords: ['restaurante', 'catering', 'gastronomía'],
  },
  {
    value: 'pizza-outline',
    icon: 'pizza-outline',
    label: 'Pizza',
    keywords: ['pizza', 'comida'],
  },
  {
    value: 'cafe-outline',
    icon: 'cafe-outline',
    label: 'Café',
    keywords: ['café', 'desayuno', 'bebidas'],
  },
  {
    value: 'wine-outline',
    icon: 'wine-outline',
    label: 'Vino',
    keywords: ['vino', 'bebidas', 'evento'],
  },
  {
    value: 'beer-outline',
    icon: 'beer-outline',
    label: 'Cerveza',
    keywords: ['cerveza', 'after', 'bebidas'],
  },
  {
    value: 'flame-outline',
    icon: 'flame-outline',
    label: 'Combustible',
    keywords: ['combustible', 'nafta', 'gasolina'],
  },
  {
    value: 'car',
    icon: 'car',
    label: 'Auto',
    keywords: ['vehículo', 'transporte', 'logística'],
  },
  {
    value: 'bus-outline',
    icon: 'bus-outline',
    label: 'Transporte',
    keywords: ['colectivo', 'viajes', 'logística'],
  },
  {
    value: 'airplane-outline',
    icon: 'airplane-outline',
    label: 'Avión',
    keywords: ['viaje', 'aéreo', 'traslado'],
  },
  {
    value: 'construct-outline',
    icon: 'construct-outline',
    label: 'Herramientas',
    keywords: ['mantenimiento', 'obra', 'reparaciones'],
  },
  {
    value: 'hammer-outline',
    icon: 'hammer-outline',
    label: 'Martillo',
    keywords: ['construcción', 'herramientas'],
  },
  {
    value: 'briefcase-outline',
    icon: 'briefcase-outline',
    label: 'Trabajo',
    keywords: ['negocio', 'proyecto', 'servicio'],
  },
  {
    value: 'business-outline',
    icon: 'business-outline',
    label: 'Oficina',
    keywords: ['empresa', 'oficina', 'administración'],
  },
  {
    value: 'people-outline',
    icon: 'people-outline',
    label: 'Equipo',
    keywords: ['equipo', 'personal', 'rrhh'],
  },
  {
    value: 'person-outline',
    icon: 'person-outline',
    label: 'Persona',
    keywords: ['cliente', 'proveedor', 'contacto'],
  },
  {
    value: 'paw-outline',
    icon: 'paw-outline',
    label: 'Mascotas',
    keywords: ['veterinaria', 'animales'],
  },
  {
    value: 'leaf-outline',
    icon: 'leaf-outline',
    label: 'Naturaleza',
    keywords: ['jardinería', 'ambiente'],
  },
  {
    value: 'barbell-outline',
    icon: 'barbell-outline',
    label: 'Gimnasio',
    keywords: ['fitness', 'deporte'],
  },
  {
    value: 'partly-sunny-outline',
    icon: 'partly-sunny-outline',
    label: 'Clima',
    keywords: ['clima', 'limpieza'],
  },
  {
    value: 'water-outline',
    icon: 'water-outline',
    label: 'Agua',
    keywords: ['servicios', 'facturas', 'agua'],
  },
];
