import { type InvoiceConcept } from '@/contexts/InvoicesContext';
import { type Job } from '@/contexts/JobsContext';
import { calculateJobTotal, getJobDurationHours, getJobHourlyRate } from '@/utils/jobTotals';

export interface InvoiceItemFormValue {
  id?: number;
  conceptCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  jobId: string;
}

const parseDecimalInput = (value: string): number | null => {
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

const cleanJobId = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

export const hasInvoiceItemData = (item: InvoiceItemFormValue): boolean => {
  if (!item) {
    return false;
  }
  if (item.conceptCode.trim().length > 0) {
    return true;
  }
  if (item.description.trim().length > 0) {
    return true;
  }
  if (parseDecimalInput(item.quantity) !== null) {
    return true;
  }
  if (parseDecimalInput(item.unitPrice) !== null) {
    return true;
  }
  if (cleanJobId(item.jobId) !== null) {
    return true;
  }
  return false;
};

export const mapInvoiceConceptToFormValue = (concept: InvoiceConcept): InvoiceItemFormValue => ({
  id: concept.id,
  conceptCode: toStringValue(concept.concept_code ?? ''),
  description: toStringValue(concept.description ?? ''),
  quantity:
    typeof concept.quantity === 'number' && Number.isFinite(concept.quantity)
      ? concept.quantity.toString()
      : '',
  unitPrice:
    typeof concept.unit_price === 'number' && Number.isFinite(concept.unit_price)
      ? concept.unit_price.toString()
      : '',
  jobId:
    typeof concept.job_id === 'number' && Number.isFinite(concept.job_id)
      ? concept.job_id.toString()
      : '',
});

export const prepareInvoiceConceptPayloads = (
  items: InvoiceItemFormValue[],
): Record<string, unknown>[] =>
  items
    .filter(item => hasInvoiceItemData(item))
    .map(item => {
      const payload: Record<string, unknown> = {};

      if (typeof item.id === 'number' && Number.isFinite(item.id)) {
        payload.id = item.id;
      }

      if (item.conceptCode.trim()) {
        payload.concept_code = item.conceptCode.trim();
      }

      if (item.description.trim()) {
        payload.description = item.description.trim();
      }

      const quantity = parseDecimalInput(item.quantity);
      if (quantity !== null) {
        payload.quantity = quantity;
      }

      const unitPrice = parseDecimalInput(item.unitPrice);
      if (unitPrice !== null) {
        payload.unit_price = unitPrice;
      }

      const jobId = cleanJobId(item.jobId);
      if (jobId !== null) {
        payload.job_id = jobId;
      }

      return payload;
    })
    .filter(payload => Object.keys(payload).length > 0);

export const calculateInvoiceItemsTotal = (items: InvoiceItemFormValue[]): number =>
  items.reduce((total, item) => {
    const quantity = parseDecimalInput(item.quantity) ?? 0;
    const unitPrice = parseDecimalInput(item.unitPrice) ?? 0;
    if (quantity <= 0 || unitPrice <= 0) {
      return total;
    }
    return total + quantity * unitPrice;
  }, 0);

const toFixedString = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
};

export const createInvoiceItemsFromJobs = (
  jobs: Job[],
  tariffAmountById: Map<number, number>,
): InvoiceItemFormValue[] =>
  jobs.map(job => {
    const hours = getJobDurationHours(job);
    const hourlyRate = getJobHourlyRate(job, tariffAmountById);
    const jobTotal = calculateJobTotal(job, tariffAmountById);

    const quantity = hours > 0 ? toFixedString(hours) : '1';
    const unitPrice = hourlyRate > 0 ? toFixedString(hourlyRate) : toFixedString(jobTotal);

    return {
      conceptCode: job.type_of_work ? job.type_of_work.toString() : '',
      description: job.description ? job.description.toString() : `Trabajo #${job.id}`,
      quantity,
      unitPrice: unitPrice || (jobTotal > 0 ? toFixedString(jobTotal) : ''),
      jobId: job.id.toString(),
    };
  });

export const mergeInvoiceItemsWithJobs = (
  currentItems: InvoiceItemFormValue[],
  jobs: Job[],
  tariffAmountById: Map<number, number>,
): InvoiceItemFormValue[] => {
  const generated = createInvoiceItemsFromJobs(jobs, tariffAmountById);
  const existingJobIds = new Set(
    currentItems
      .map(item => item.jobId.trim())
      .filter(jobId => jobId.length > 0),
  );

  const toAdd = generated.filter(item => !existingJobIds.has(item.jobId.trim()));
  if (toAdd.length === 0) {
    return currentItems;
  }
  return [...currentItems, ...toAdd];
};
