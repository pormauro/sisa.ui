// C:/Users/Mauri/Documents/GitHub/router/contexts/JobsContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, sortByNewest, SortableDate } from '@/utils/sort';

export interface Job {
  id: number;
  user_id: number;
  client_id: number;
  description: string;
  created_at?: string | null;
  updated_at?: string | null;
  /** Fecha del trabajo en formato YYYY-MM-DD */
  job_date?: string | null;
  /** Hora de inicio en formato HH:mm */
  start_time: string;
  /** Hora de finalización en formato HH:mm */
  end_time: string;
  /** Fecha y hora de inicio derivada en formato ISO local (YYYY-MM-DDTHH:mm:ss) */
  datetime_start?: string;
  /** Fecha y hora de finalización derivada en formato ISO local (YYYY-MM-DDTHH:mm:ss) */
  datetime_end?: string;
  type_of_work?: string;
  /** Identificador de estado asociado */
  status_id: number | null;
  folder_id?: number | null;
  product_service_id?: number | null;
  multiplicative_value?: number;
  tariff_id?: number | null;
  manual_amount?: number | null;
  /** IDs de archivos adjuntos en formato JSON */
  attached_files?: number[] | string | null;
  /** IDs de participantes en formato JSON */
  participants?: number[] | string | null;
}

const getJobSortValue = (job: Job): SortableDate => {
  if (job.created_at) {
    return job.created_at;
  }
  if (job.updated_at) {
    return job.updated_at;
  }
  if (job.job_date) {
    const time = job.start_time?.length === 5 ? `${job.start_time}:00` : job.start_time ?? '00:00:00';
    return `${job.job_date}T${time}`;
  }
  return job.id;
};

const parseNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[^0-9,.-]/g, '');
  if (!cleaned) {
    return null;
  }

  let normalized = cleaned;

  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';

    normalized = cleaned.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '');

    if (decimalSeparator !== '.') {
      normalized = normalized.replace(new RegExp(`\\${decimalSeparator}`, 'g'), '.');
    }
  } else if (hasComma) {
    normalized = cleaned.replace(/,/g, '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumber = (value: unknown): number => {
  const parsed = parseNumberValue(value);
  if (parsed !== null) {
    return parsed;
  }

  if (value === null || typeof value === 'undefined' || value === '') {
    return 0;
  }

  const fallback = Number(value);
  return Number.isFinite(fallback) ? fallback : 0;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = parseNumberValue(value);
  if (parsed !== null) {
    return parsed;
  }

  const fallback = Number(value);
  return Number.isFinite(fallback) ? fallback : null;
};

interface JobsContextType {
  jobs: Job[];
  loadJobs: () => void;
  addJob: (job: Omit<Job, 'id' | 'user_id'>) => Promise<Job | null>;
  updateJob: (id: number, job: Omit<Job, 'id' | 'user_id'>) => Promise<boolean>;
  deleteJob: (id: number) => Promise<boolean>;
}

export const JobsContext = createContext<JobsContextType>({
  jobs: [],
  loadJobs: () => {},
  addJob: async () => null,
  updateJob: async () => false,
  deleteJob: async () => false,
});

export const JobsProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useCachedState<Job[]>('jobs', []);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    setJobs(prev => ensureSortedByNewest(prev, getJobSortValue, job => job.id));
  }, [setJobs]);

  const extractDate = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const [firstPart] = trimmed.split(/[T\s]/);
    return /^\d{4}-\d{2}-\d{2}$/.test(firstPart) ? firstPart : null;
  };

  const extractTime = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/[T\s]/);
    const timeCandidate = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const match = timeCandidate.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;
    const [, hours, minutes] = match;
    return `${hours}:${minutes}`;
  };

  const buildDateTime = (jobDate?: string | null, time?: string | null): string | null => {
    const datePart = extractDate(jobDate);
    const timePart = extractTime(time);
    if (!datePart || !timePart) {
      return null;
    }
    return `${datePart}T${timePart}:00`;
  };

  const shouldSwapTimes = (startTime?: string | null, endTime?: string | null): boolean => {
    const start = extractTime(startTime);
    const end = extractTime(endTime);
    if (!start || !end) return false;
    return end < start;
  };

  const normalizeJobPayload = (jobData: Omit<Job, 'id' | 'user_id'>) => {
    const normalizedStartTime = extractTime(jobData.start_time) ?? '';
    const normalizedEndTime = extractTime(jobData.end_time) ?? '';
    const normalizedJobDate = extractDate(jobData.job_date) ?? null;

    const startTime = shouldSwapTimes(normalizedStartTime, normalizedEndTime)
      ? normalizedEndTime
      : normalizedStartTime;
    const endTime = shouldSwapTimes(normalizedStartTime, normalizedEndTime)
      ? normalizedStartTime
      : normalizedEndTime;

    return {
      ...jobData,
      start_time: startTime,
      end_time: endTime,
      tariff_id: jobData.tariff_id ?? null,
      manual_amount: jobData.manual_amount ?? null,
      status_id: jobData.status_id ?? null,
      attached_files:
        typeof jobData.attached_files === 'string'
          ? jobData.attached_files
          : jobData.attached_files
          ? JSON.stringify(jobData.attached_files)
          : null,
      participants:
        jobData.participants && jobData.participants.length > 0
          ? JSON.stringify(jobData.participants)
          : null,
      folder_id: jobData.folder_id ?? null,
      job_date: normalizedJobDate,
    };
  };

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.jobs) {
        const parsed = data.jobs.map((j: any) => {
          const participants = j.participants
            ? typeof j.participants === 'string'
              ? JSON.parse(j.participants)
              : j.participants
            : null;

          const normalizedJobDate = extractDate(j.job_date) ?? null;
          const normalizedStartTime = extractTime(j.start_time) ?? '';
          const normalizedEndTime = extractTime(j.end_time) ?? '';

          return {
            ...j,
            id: toNumber(j.id),
            user_id: toNumber(j.user_id),
            client_id: toNumber(j.client_id),
            job_date: normalizedJobDate,
            start_time: normalizedStartTime,
            end_time: normalizedEndTime,
            datetime_start: buildDateTime(normalizedJobDate, normalizedStartTime),
            datetime_end: buildDateTime(normalizedJobDate, normalizedEndTime),
            status_id: toNullableNumber(j.status_id),
            folder_id: toNullableNumber(j.folder_id),
            product_service_id: toNullableNumber(j.product_service_id),
            multiplicative_value: toNullableNumber(j.multiplicative_value),
            tariff_id: toNullableNumber(j.tariff_id),
            manual_amount: toNullableNumber(j.manual_amount),
            participants,
          } as Job;
        });
        setJobs(sortByNewest(parsed, getJobSortValue, job => job.id));
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  }, [setJobs, token]);

  const addJob = async (jobData: Omit<Job, 'id' | 'user_id'>): Promise<Job | null> => {
    try {
      const payload = normalizeJobPayload(jobData);
      const res = await fetch(`${BASE_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          console.error('Error adding job: invalid JSON response', text);
        }
      }
      if (!res.ok || data?.error) {
        console.error('Error adding job:', data?.error || data?.message || res.statusText);
        return null;
      }

      const rawId =
        data?.job_id ??
        data?.jobId ??
        data?.id ??
        data?.job?.id ??
        data?.job?.job_id ??
        null;
      const parsedId =
        typeof rawId === 'string'
          ? parseInt(rawId, 10)
          : typeof rawId === 'number'
          ? rawId
          : null;

      await loadJobs(); // asegura consistencia
      return {
        id: parsedId ?? 0,
        user_id: data?.job?.user_id ?? 0,
        ...payload,
      };
    } catch (err) {
      console.error('Error adding job:', err);
    }
    return null;
  };

  const updateJob = async (id: number, jobData: Omit<Job, 'id' | 'user_id'>): Promise<boolean> => {
    try {
      const payload = normalizeJobPayload(jobData);
      const res = await fetch(`${BASE_URL}/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('Error updating job: invalid JSON response', text);
        return false;
      }
      if (data.message === 'Job updated successfully') {
        await loadJobs(); // recarga para obtener datos frescos del servidor
        return true;
      }
    } catch (err) {
      console.error('Error updating job:', err);
    }
    return false;
  };

  const deleteJob = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/jobs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('Error deleting job: invalid JSON response', text);
        return false;
      }
      if (data.message === 'Job deleted successfully') {
        setJobs(prev => prev.filter(j => j.id !== id));
        return true;
      }
    } catch (err) {
      console.error('Error deleting job:', err);
    }
    return false;
  };

  return (
    <JobsContext.Provider value={{ jobs, loadJobs, addJob, updateJob, deleteJob }}>
      {children}
    </JobsContext.Provider>
  );
};
