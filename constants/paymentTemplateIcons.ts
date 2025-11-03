import type { IconName } from '@/constants/menuSections';

export interface PaymentTemplateIconOption {
  icon: IconName;
  label: string;
}

export const PAYMENT_TEMPLATE_ICON_OPTIONS: PaymentTemplateIconOption[] = [
  { icon: 'sparkles-outline', label: 'Destacado' },
  { icon: 'flash-outline', label: 'Relámpago' },
  { icon: 'card', label: 'Tarjeta' },
  { icon: 'cash-outline', label: 'Efectivo' },
  { icon: 'wallet', label: 'Billetera' },
  { icon: 'receipt-outline', label: 'Recibo' },
  { icon: 'document-text-outline', label: 'Documento' },
  { icon: 'repeat', label: 'Recurrente' },
  { icon: 'send-outline', label: 'Enviar' },
  { icon: 'briefcase-outline', label: 'Trabajo' },
  { icon: 'calendar-outline', label: 'Calendario' },
  { icon: 'pricetag-outline', label: 'Tarifa' },
];

export const DEFAULT_PAYMENT_TEMPLATE_ICON: IconName = PAYMENT_TEMPLATE_ICON_OPTIONS[0].icon;
