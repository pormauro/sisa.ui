import { Job } from '@/contexts/JobsContext';

const normalizeTimeValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  let trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const separators = [' ', 'T'];
  separators.forEach(separator => {
    if (trimmed.includes(separator)) {
      const parts = trimmed.split(separator);
      trimmed = parts[parts.length - 1] ?? trimmed;
    }
  });

  trimmed = trimmed.replace(/[zZ]$/, '');
  const timezoneIndex = trimmed.search(/[+-]/);
  if (timezoneIndex > 0) {
    trimmed = trimmed.slice(0, timezoneIndex);
  }

  const timeSegments = trimmed.split(':').filter(Boolean);
  if (timeSegments.length === 0) {
    return null;
  }

  const [hours = '00', minutes = '00', secondsWithFraction = '00'] = timeSegments;
  const [seconds = '00'] = secondsWithFraction.split('.');
  const normalizedHours = hours.padStart(2, '0');
  const normalizedMinutes = minutes.padStart(2, '0');
  const normalizedSeconds = seconds.padStart(2, '0');

  return `${normalizedHours}:${normalizedMinutes}:${normalizedSeconds}`;
};

export const getJobDurationHours = (job: Job): number => {
  const start = normalizeTimeValue(job.start_time);
  const end = normalizeTimeValue(job.end_time);

  if (!start || !end) {
    return 0;
  }

  const startDate = new Date(`1970-01-01T${start}`);
  const endDate = new Date(`1970-01-01T${end}`);

  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return 0;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return diffMs / (1000 * 60 * 60);
};

export const getJobHourlyRate = (
  job: Job,
  tariffAmountById: Map<number, number>,
): number => {
  const manualAmount = job.manual_amount;
  if (typeof manualAmount === 'number' && Number.isFinite(manualAmount)) {
    return manualAmount;
  }

  if (typeof manualAmount === 'string') {
    const parsedManual = Number(manualAmount.trim());
    if (Number.isFinite(parsedManual)) {
      return parsedManual;
    }
  }

  if (job.tariff_id != null) {
    const tariffAmount = tariffAmountById.get(job.tariff_id);
    if (typeof tariffAmount === 'number' && Number.isFinite(tariffAmount)) {
      return tariffAmount;
    }
  }

  return 0;
};

export const calculateJobTotal = (
  job: Job,
  tariffAmountById: Map<number, number>,
): number => {
  const durationHours = getJobDurationHours(job);
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return 0;
  }

  const hourlyRate = getJobHourlyRate(job, tariffAmountById);
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return 0;
  }

  return durationHours * hourlyRate;
};

export const calculateJobsTotal = (
  jobs: Job[],
  selectedIds: Set<number>,
  tariffAmountById: Map<number, number>,
): number => {
  if (selectedIds.size === 0) {
    return 0;
  }

  return jobs.reduce((total, job) => {
    if (!selectedIds.has(job.id)) {
      return total;
    }

    const jobTotal = calculateJobTotal(job, tariffAmountById);
    if (!Number.isFinite(jobTotal) || jobTotal <= 0) {
      return total;
    }

    return total + jobTotal;
  }, 0);
};

export const parseJobIdsParam = (
  param?: string | string[],
): number[] => {
  if (!param) {
    return [];
  }

  const normalized = Array.isArray(param) ? param[0] : param;
  if (!normalized) {
    return [];
  }

  return normalized
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => Number(item))
    .filter(value => Number.isFinite(value));
};

export const formatJobIdsParam = (ids: number[]): string => ids.map(id => id.toString()).join(',');

