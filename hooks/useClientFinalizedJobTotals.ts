import { useCallback, useContext, useMemo } from 'react';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { StatusesContext, Status } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';

const FINALIZED_KEYWORDS = new Set([
  'finalizado',
  'finalizada',
  'finalized',
  'finalised',
  'completado',
  'completada',
  'completed',
]);

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

const getJobDurationHours = (job: Job): number => {
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

const getJobHourlyRate = (job: Job, tariffAmountById: Map<number, number>): number => {
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

export const isStatusFinalized = (status?: Status): boolean => {
  if (!status) {
    return false;
  }

  const candidates = [status.label]
    .map(value => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean);

  return candidates.some(candidate => FINALIZED_KEYWORDS.has(candidate));
};

export const useClientFinalizedJobTotals = () => {
  const { jobs } = useContext(JobsContext);
  const { statuses } = useContext(StatusesContext);
  const { tariffs } = useContext(TariffsContext);

  const totalsMap = useMemo(() => {
    const statusById = new Map<number, Status>();
    statuses.forEach(status => {
      statusById.set(status.id, status);
    });

    const tariffAmountById = new Map<number, number>();
    tariffs.forEach(tariff => {
      tariffAmountById.set(tariff.id, tariff.amount);
    });

    const totals = new Map<number, number>();

    jobs.forEach(job => {
      if (!job || job.client_id == null) {
        return;
      }

      const status = job.status_id != null ? statusById.get(job.status_id) : undefined;
      if (!isStatusFinalized(status)) {
        return;
      }

      const durationHours = getJobDurationHours(job);
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        return;
      }

      const hourlyRate = getJobHourlyRate(job, tariffAmountById);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        return;
      }

      const totalForJob = durationHours * hourlyRate;
      const previousTotal = totals.get(job.client_id) ?? 0;
      totals.set(job.client_id, previousTotal + totalForJob);
    });

    return totals;
  }, [jobs, statuses, tariffs]);

  const getTotalForClient = useCallback(
    (clientId: number | null | undefined) => {
      if (clientId == null) {
        return 0;
      }
      const total = totalsMap.get(clientId);
      return typeof total === 'number' && Number.isFinite(total) ? total : 0;
    },
    [totalsMap]
  );

  return { totalsMap, getTotalForClient };
};

export type ClientFinalizedJobTotalsHook = ReturnType<typeof useClientFinalizedJobTotals>;
