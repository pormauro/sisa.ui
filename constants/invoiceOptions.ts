export interface VoucherDefinition {
  value: string;
  label: string;
  keywords: string[];
}

export const FACTURA_X_VOUCHER_TYPE = '201';

export const VOUCHER_DEFINITIONS: VoucherDefinition[] = [
  { value: '1', label: 'Factura A (01)', keywords: ['factura a'] },
  { value: '6', label: 'Factura B (06)', keywords: ['factura b'] },
  { value: '11', label: 'Factura C (11)', keywords: ['factura c'] },
  { value: '3', label: 'Nota de Crédito A (03)', keywords: ['nota de credito a'] },
  { value: '8', label: 'Nota de Crédito B (08)', keywords: ['nota de credito b'] },
  { value: '13', label: 'Nota de Crédito C (13)', keywords: ['nota de credito c'] },
  { value: FACTURA_X_VOUCHER_TYPE, label: 'Factura X (201)', keywords: ['factura x'] },
];

export const DOCUMENT_TYPES = [
  { label: 'Sin documento', value: '' },
  { label: 'CUIT (80)', value: '80' },
  { label: 'CUIL (86)', value: '86' },
  { label: 'DNI (96)', value: '96' },
  { label: 'Pasaporte (94)', value: '94' },
];
