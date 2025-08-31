// C:/Users/Mauri/Documents/GitHub/router/contexts/JobsContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

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
  status?: string;
  folder_id?: number | null;
  product_service_id?: number | null;
  multiplicative_value?: number;
  tariff_id?: number | null;
  manual_amount?: number | null;
  /** Cadena JSON con archivos adjuntos */
  attached_files?: string | null;
}

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
  const [jobs, setJobs] = useState<Job[]>([]);
  const { token } = useContext(AuthContext);

  const loadJobs = async () => {
    try {
      const res = await fetch(`${BASE_URL}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  };

  const addJob = async (jobData: Omit<Job, 'id' | 'user_id'>): Promise<Job | null> => {
    try {
      const res = await fetch(`${BASE_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(jobData),
      });
      const data = await res.json();
      if (data.job_id) {
        await loadJobs(); // asegura consistencia
        return { id: data.job_id, user_id: 0, ...jobData };
      }
    } catch (err) {
      console.error('Error adding job:', err);
    }
    return null;
  };

  const updateJob = async (id: number, jobData: Omit<Job, 'id' | 'user_id'>): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(jobData),
      });
      const data = await res.json();
      if (data.message === 'Job updated successfully') {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...jobData } : j)));
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
      const data = await res.json();
      if (data.message === 'Job deleted successfully') {
        setJobs((prev) => prev.filter((j) => j.id !== id));
        return true;
      }
    } catch (err) {
      console.error('Error deleting job:', err);
    }
    return false;
  };

  useEffect(() => {
    if (token) loadJobs();
  }, [token]);

  return (
    <JobsContext.Provider value={{ jobs, loadJobs, addJob, updateJob, deleteJob }}>
      {children}
    </JobsContext.Provider>
  );
};
