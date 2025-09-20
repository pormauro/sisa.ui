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

export interface Job {
  id: number;
  user_id: number;
  client_id: number;
  description: string;
  /** Fecha del trabajo en formato YYYY-MM-DD */
  job_date?: string | null;
  /** Hora de inicio en formato HH:mm */
  start_time: string;
  /** Hora de finalización en formato HH:mm */
  end_time: string;
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

  const normalized = cleaned.includes('.') && cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(/,/g, '.')
    : cleaned.replace(/,/g, '.');

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

  const normalizeTime = (time: string) => (time && time.length === 5 ? `${time}:00` : time);

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

          return {
            ...j,
            id: toNumber(j.id),
            user_id: toNumber(j.user_id),
            client_id: toNumber(j.client_id),
            status_id: toNullableNumber(j.status_id),
            folder_id: toNullableNumber(j.folder_id),
            product_service_id: toNullableNumber(j.product_service_id),
            multiplicative_value: toNullableNumber(j.multiplicative_value),
            tariff_id: toNullableNumber(j.tariff_id),
            manual_amount: toNullableNumber(j.manual_amount),
            participants,
          } as Job;
        });
        setJobs(parsed);
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  }, [setJobs, token]);

  const addJob = async (jobData: Omit<Job, 'id' | 'user_id'>): Promise<Job | null> => {
    try {
      const payload = {
        ...jobData,
        start_time: normalizeTime(jobData.start_time),
        end_time: normalizeTime(jobData.end_time),
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
        job_date: jobData.job_date ?? null,
      };
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
      const payload = {
        ...jobData,
        start_time: normalizeTime(jobData.start_time),
        end_time: normalizeTime(jobData.end_time),
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
        job_date: jobData.job_date ?? null,
      };
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

  useEffect(() => {
    if (token) void loadJobs();
  }, [loadJobs, token]);

  return (
    <JobsContext.Provider value={{ jobs, loadJobs, addJob, updateJob, deleteJob }}>
      {children}
    </JobsContext.Provider>
  );
};
