// C:/Users/Mauri/Documents/GitHub/router/contexts/JobsContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import {
  clearQueue as clearQueueDB,
  createSyncQueueTable,
  deleteQueueItem,
  enqueueOperation,
  getAllQueueItems,
  updateQueueItemStatus,
} from '@/src/database/syncQueueDB';
import {
  createLocalJobsTable,
  getAllJobsLocal,
  clearLocalJobs,
  insertJobLocal,
} from '@/src/database/jobsLocalDB';

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
  syncStatus?: 'pending' | 'error';
  pendingDelete?: boolean;
}

export interface QueueItem {
  id: number;
  table_name: string;
  op: string;
  record_id: number | null;
  local_temp_id: number | null;
  payload_json: string;
  status: string;
  last_error?: string | null;
}

interface JobsContextType {
  jobs: Job[];
  queue: QueueItem[];
  loadJobs: () => void;
  addJob: (job: Omit<Job, 'id' | 'user_id'>) => Promise<Job | null>;
  updateJob: (id: number, job: Omit<Job, 'id' | 'user_id'>) => Promise<boolean>;
  deleteJob: (id: number) => Promise<boolean>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const JobsContext = createContext<JobsContextType>({
  jobs: [],
  queue: [],
  loadJobs: () => {},
  addJob: async () => null,
  updateJob: async () => false,
  deleteJob: async () => false,
  processQueue: async () => {},
  clearQueue: async () => {},
});

export const JobsProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { token } = useContext(AuthContext);

  const loadQueue = async () => {
    const items = await getAllQueueItems();
    setQueue(items);
  };

  useEffect(() => {
    createSyncQueueTable();
    createLocalJobsTable();
    loadQueue();
  }, []);

  const normalizeTime = (time: string) => (time && time.length === 5 ? `${time}:00` : time);

  const buildPayload = (jobData: Omit<Job, 'id' | 'user_id'>) => ({
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
  });

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const fetchJobs = async (attempt = 0): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      const localJobs = await getAllJobsLocal();
      setJobs(localJobs as Job[]);
      Alert.alert('Sin conexión', 'Mostrando datos locales.');
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchJobs(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      }
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.jobs) {
        const parsed = data.jobs.map((j: any) => ({
          ...j,
          participants: j.participants
            ? typeof j.participants === 'string'
              ? JSON.parse(j.participants)
              : j.participants
            : null,
        }));
        await clearLocalJobs();
        for (const job of parsed) {
          await insertJobLocal(job);
        }
        setJobs(parsed);
      }
    } catch (err) {
      if (__DEV__) {
        console.log('Error loading jobs:', err);
      }
      if (attempt < MAX_RETRIES) {
        setTimeout(() => fetchJobs(attempt + 1), RETRY_DELAY * Math.pow(2, attempt));
      } else {
        Alert.alert('Error de red', 'No se pudieron cargar los trabajos.');
      }
    }
  };

  const loadJobs = async () => {
    await fetchJobs();
  };

  const addJob = async (jobData: Omit<Job, 'id' | 'user_id'>): Promise<Job | null> => {
    const payload = buildPayload(jobData);
    const tempId = Date.now() * -1;
    const newJob: Job = { id: tempId, user_id: 0, ...payload, syncStatus: 'pending' };
    setJobs(prev => [...prev, newJob]);
    await enqueueOperation('jobs', 'create', payload, null, tempId);
    await loadQueue();
    processQueue();
    return newJob;
  };

  const updateJob = async (id: number, jobData: Omit<Job, 'id' | 'user_id'>): Promise<boolean> => {
    const payload = buildPayload(jobData);
    setJobs(prev =>
      prev.map(job =>
        job.id === id ? { ...job, ...payload, syncStatus: 'pending' } : job
      )
    );
    await enqueueOperation('jobs', 'update', payload, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const deleteJob = async (id: number): Promise<boolean> => {
    setJobs(prev =>
      prev.map(job =>
        job.id === id ? { ...job, pendingDelete: true, syncStatus: 'pending' } : job
      )
    );
    await enqueueOperation('jobs', 'delete', {}, id, null);
    await loadQueue();
    processQueue();
    return true;
  };

  const clearQueue = async (): Promise<void> => {
    await clearQueueDB();
    await loadQueue();
  };

  const processQueue = async () => {
    if (!token) return;
    const items = await getAllQueueItems();
    for (const item of items) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
        if (item.table_name === 'jobs') {
          if (item.op === 'create') {
            const response = await fetch(`${BASE_URL}/jobs`, {
              method: 'POST',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const data = await response.json();
              const newId = parseInt(data.job_id, 10);
              setJobs(prev =>
                prev.map(j =>
                  j.id === item.local_temp_id ? { ...j, id: newId, syncStatus: undefined } : j
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'update') {
            const response = await fetch(`${BASE_URL}/jobs/${item.record_id}`, {
              method: 'PUT',
              headers,
              body: item.payload_json,
            });
            if (response.ok) {
              const payload = JSON.parse(item.payload_json);
              setJobs(prev =>
                prev.map(j =>
                  j.id === item.record_id ? { ...j, ...payload, syncStatus: undefined } : j
                )
              );
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          } else if (item.op === 'delete') {
            const response = await fetch(`${BASE_URL}/jobs/${item.record_id}`, {
              method: 'DELETE',
              headers,
            });
            if (response.ok) {
              setJobs(prev => prev.filter(j => j.id !== item.record_id));
              await deleteQueueItem(item.id);
            } else {
              await updateQueueItemStatus(item.id, 'error', `HTTP ${response.status}`);
              break;
            }
          }
        }
      } catch (err: any) {
        await updateQueueItemStatus(item.id, 'error', String(err));
        break;
      }
    }
    await loadQueue();
  };

  useEffect(() => {
    if (!token) return;

    const sync = async () => {
      try {
        await processQueue();
      } catch (e) {}
      try {
        await loadJobs();
      } catch (e) {}
    };
    sync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue()
          .then(() => loadJobs().catch(() => {}))
          .catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [token]);

  return (
    <JobsContext.Provider value={{ jobs, queue, loadJobs, addJob, updateJob, deleteJob, processQueue, clearQueue }}>
      {children}
    </JobsContext.Provider>
  );
};
