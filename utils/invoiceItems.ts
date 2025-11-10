import { type InvoiceItem } from '@/contexts/InvoicesContext';

export interface InvoiceItemFormValue {
  id?: number;
  invoiceId?: number;
  description: string;
  quantity: string;
  unitPrice: string;
  productId: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  orderIndex: string;
}

export const parseInvoiceDecimalInput = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringValue = (value: unknown): string => {
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  return String(value);
};

export const hasInvoiceItemData = (item: InvoiceItemFormValue): boolean => {
  if (!item) {
    return false;
  }
  if (item.description.trim().length > 0) {
    return true;
  }
  if (parseInvoiceDecimalInput(item.quantity) !== null) {
    return true;
  }
  if (parseInvoiceDecimalInput(item.unitPrice) !== null) {
    return true;
  }
  if (parseInvoiceDecimalInput(item.discountAmount) !== null) {
    return true;
  }
  if (parseInvoiceDecimalInput(item.taxAmount) !== null) {
    return true;
  }
  if (parseInvoiceDecimalInput(item.totalAmount) !== null) {
    return true;
  }
  if (item.productId.trim().length > 0) {
    return true;
  }
  if (item.orderIndex.trim().length > 0) {
    return true;
  }
  return false;
};

export const mapInvoiceItemToFormValue = (item: InvoiceItem): InvoiceItemFormValue => ({
  id: item.id,
  invoiceId:
    typeof item.invoice_id === 'number' && Number.isFinite(item.invoice_id)
      ? item.invoice_id
      : undefined,
  description: toStringValue(item.description ?? ''),
  quantity:
    typeof item.quantity === 'number' && Number.isFinite(item.quantity)
      ? item.quantity.toString()
      : '',
  unitPrice:
    typeof item.unit_price === 'number' && Number.isFinite(item.unit_price)
      ? item.unit_price.toString()
      : '',
  productId:
    typeof item.product_id === 'number' && Number.isFinite(item.product_id)
      ? item.product_id.toString()
      : '',
  discountAmount:
    typeof item.discount_amount === 'number' && Number.isFinite(item.discount_amount)
      ? item.discount_amount.toString()
      : '',
  taxAmount:
    typeof item.tax_amount === 'number' && Number.isFinite(item.tax_amount)
      ? item.tax_amount.toString()
      : '',
  totalAmount:
    typeof item.total_amount === 'number' && Number.isFinite(item.total_amount)
      ? item.total_amount.toString()
      : '',
  orderIndex:
    typeof item.order_index === 'number' && Number.isFinite(item.order_index)
      ? item.order_index.toString()
      : '',
});

export const prepareInvoiceItemPayloads = (
  items: InvoiceItemFormValue[],
): Record<string, unknown>[] =>
  items
    .filter(item => hasInvoiceItemData(item))
    .map(item => {
      const payload: Record<string, unknown> = {};

      if (typeof item.id === 'number' && Number.isFinite(item.id)) {
        payload.id = item.id;
      }

      if (item.description.trim()) {
        payload.description = item.description.trim();
      }

      const quantity = parseInvoiceDecimalInput(item.quantity);
      if (quantity !== null) {
        payload.quantity = quantity;
      }

      const unitPrice = parseInvoiceDecimalInput(item.unitPrice);
      if (unitPrice !== null) {
        payload.unit_price = unitPrice;
      }

      const discountAmount = parseInvoiceDecimalInput(item.discountAmount);
      if (discountAmount !== null) {
        payload.discount_amount = discountAmount;
      }

      const taxAmount = parseInvoiceDecimalInput(item.taxAmount);
      if (taxAmount !== null) {
        payload.tax_amount = taxAmount;
      }

      const totalAmount = parseInvoiceDecimalInput(item.totalAmount);
      if (totalAmount !== null) {
        payload.total_amount = totalAmount;
      }

      if (item.productId.trim()) {
        const parsedProductId = Number(item.productId.trim());
        if (Number.isFinite(parsedProductId)) {
          payload.product_id = parsedProductId;
        }
      }

      if (item.orderIndex.trim()) {
        const parsedOrder = Number(item.orderIndex.trim());
        if (Number.isFinite(parsedOrder)) {
          payload.order_index = parsedOrder;
        }
      }

      if (typeof item.invoiceId === 'number' && Number.isFinite(item.invoiceId)) {
        payload.invoice_id = item.invoiceId;
      }

      return payload;
    })
    .filter(payload => Object.keys(payload).length > 0);

const computeItemTotal = (item: InvoiceItemFormValue): number => {
  const explicitTotal = parseInvoiceDecimalInput(item.totalAmount);
  if (explicitTotal !== null) {
    return explicitTotal;
  }

  const quantity = parseInvoiceDecimalInput(item.quantity) ?? 0;
  const unitPrice = parseInvoiceDecimalInput(item.unitPrice) ?? 0;
  const discountAmount = parseInvoiceDecimalInput(item.discountAmount) ?? 0;
  const taxAmount = parseInvoiceDecimalInput(item.taxAmount) ?? 0;

  if (quantity <= 0 || unitPrice <= 0) {
    return Math.max(0, taxAmount - discountAmount);
  }

  return Math.max(0, quantity * unitPrice - discountAmount + taxAmount);
};

export const calculateInvoiceItemsTotal = (items: InvoiceItemFormValue[]): number =>
  items.reduce((total, item) => total + computeItemTotal(item), 0);

export const calculateInvoiceItemsSubtotal = (items: InvoiceItemFormValue[]): number =>
  items.reduce((total, item) => {
    const quantity = parseInvoiceDecimalInput(item.quantity);
    const unitPrice = parseInvoiceDecimalInput(item.unitPrice);
    const discountAmount = parseInvoiceDecimalInput(item.discountAmount) ?? 0;
    const totalAmount = parseInvoiceDecimalInput(item.totalAmount);
    const taxAmount = parseInvoiceDecimalInput(item.taxAmount);

    if (quantity !== null && quantity > 0 && unitPrice !== null && unitPrice > 0) {
      const subtotal = Math.max(0, quantity * unitPrice - discountAmount);
      return total + subtotal;
    }

    if (totalAmount !== null) {
      const derivedSubtotal = Math.max(0, totalAmount - (taxAmount ?? 0));
      return total + derivedSubtotal;
    }

    return total;
  }, 0);

export const calculateInvoiceItemsTax = (items: InvoiceItemFormValue[]): number =>
  items.reduce((total, item) => {
    const taxAmount = parseInvoiceDecimalInput(item.taxAmount);
    if (taxAmount !== null) {
      return total + Math.max(0, taxAmount);
    }

    const totalAmount = parseInvoiceDecimalInput(item.totalAmount);
    const quantity = parseInvoiceDecimalInput(item.quantity);
    const unitPrice = parseInvoiceDecimalInput(item.unitPrice);
    const discountAmount = parseInvoiceDecimalInput(item.discountAmount) ?? 0;

    if (
      totalAmount !== null &&
      quantity !== null &&
      quantity > 0 &&
      unitPrice !== null &&
      unitPrice > 0
    ) {
      const subtotal = Math.max(0, quantity * unitPrice - discountAmount);
      const derivedTax = Math.max(0, totalAmount - subtotal);
      return total + derivedTax;
    }

    return total;
  }, 0);

export const invoiceItemsProvideSubtotalData = (items: InvoiceItemFormValue[]): boolean =>
  items.some(item => {
    const quantity = parseInvoiceDecimalInput(item.quantity);
    const unitPrice = parseInvoiceDecimalInput(item.unitPrice);
    const totalAmount = parseInvoiceDecimalInput(item.totalAmount);

    if (quantity !== null && quantity > 0 && unitPrice !== null && unitPrice > 0) {
      return true;
    }

    return totalAmount !== null;
  });

export const invoiceItemsProvideTaxData = (items: InvoiceItemFormValue[]): boolean =>
  items.some(item => {
    if (parseInvoiceDecimalInput(item.taxAmount) !== null) {
      return true;
    }

    const totalAmount = parseInvoiceDecimalInput(item.totalAmount);
    const quantity = parseInvoiceDecimalInput(item.quantity);
    const unitPrice = parseInvoiceDecimalInput(item.unitPrice);

    return (
      totalAmount !== null &&
      quantity !== null &&
      quantity > 0 &&
      unitPrice !== null &&
      unitPrice > 0
    );
  });
