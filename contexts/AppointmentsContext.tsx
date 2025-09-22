import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  ReactNode,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

export interface Appointment {
  id: number;
  user_id: number;
  client_id: number;
  job_id: number | null;
  appointment_date: string;
  appointment_time: string;
  location: string | null;
  site_image_file_id: number | null;
  attached_files: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AppointmentsContextValue {
  appointments: Appointment[];
  isLoading: boolean;
  loadAppointments: () => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'user_id'>) => Promise<Appointment | null>;
  updateAppointment: (id: number, appointment: Omit<Appointment, 'id' | 'user_id'>) => Promise<boolean>;
  deleteAppointment: (id: number) => Promise<boolean>;
}

const noop = async () => {};

export const AppointmentsContext = createContext<AppointmentsContextValue>({
  appointments: [],
  isLoading: false,
  loadAppointments: noop,
  addAppointment: async () => null,
  updateAppointment: async () => false,
  deleteAppointment: async () => false,
});

const normalizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toTimestampString = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const serializeAttachedFiles = (value: Appointment['attached_files']) => {
  if (!value) {
    return null;
  }
  try {
    JSON.parse(value);
    return value;
  } catch {
    return null;
  }
};

export const AppointmentsProvider = ({ children }: { children: ReactNode }) => {
  const { token, userId, isLoading: authIsLoading } = useContext(AuthContext);
  const [appointments, setAppointments, appointmentsHydrated] = useCachedState<Appointment[]>(
    'appointments',
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const previousUserIdRef = useRef<string | null>(null);

  const parseAppointment = useCallback((raw: any): Appointment => ({
    id: Number(raw.id),
    user_id: Number(raw.user_id),
    client_id: Number(raw.client_id),
    job_id: normalizeNumber(raw.job_id),
    appointment_date: raw.appointment_date,
    appointment_time: raw.appointment_time?.slice(0, 5) ?? raw.appointment_time,
    location: raw.location ?? null,
    site_image_file_id: normalizeNumber(raw.site_image_file_id),
    attached_files:
      typeof raw.attached_files === 'string'
        ? raw.attached_files
        : raw.attached_files
        ? JSON.stringify(raw.attached_files)
        : null,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
  }), []);

  const loadAppointments = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/appointments`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (Array.isArray(data.appointments)) {
        setAppointments(data.appointments.map(parseAppointment));
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Error', 'No se pudieron cargar las citas.');
    } finally {
      setIsLoading(false);
    }
  }, [parseAppointment, setAppointments, token]);

  const addAppointment = useCallback(
    async (appointment: Omit<Appointment, 'id' | 'user_id'>): Promise<Appointment | null> => {
      if (!token) return null;
      try {
        const payload = {
          ...appointment,
          job_id: appointment.job_id ?? null,
          location: appointment.location ?? '',
          site_image_file_id: appointment.site_image_file_id ?? null,
          attached_files: serializeAttachedFiles(appointment.attached_files),
          timestamp: toTimestampString(),
        };
        const response = await fetch(`${BASE_URL}/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || 'No se pudo crear la cita.');
        }
        await loadAppointments();
        return {
          id: Number(data.appointment_id ?? 0),
          user_id: 0,
          ...appointment,
        };
      } catch (error) {
        console.error('Error adding appointment:', error);
        Alert.alert('Error', 'No se pudo crear la cita.');
        return null;
      }
    },
    [loadAppointments, token]
  );

  const updateAppointment = useCallback(
    async (id: number, appointment: Omit<Appointment, 'id' | 'user_id'>): Promise<boolean> => {
      if (!token) return false;
      try {
        const payload = {
          ...appointment,
          job_id: appointment.job_id ?? null,
          location: appointment.location ?? '',
          site_image_file_id: appointment.site_image_file_id ?? null,
          attached_files: serializeAttachedFiles(appointment.attached_files),
          timestamp: toTimestampString(),
        };
        const response = await fetch(`${BASE_URL}/appointments/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || 'No se pudo actualizar la cita.');
        }
        await loadAppointments();
        return true;
      } catch (error) {
        console.error('Error updating appointment:', error);
        Alert.alert('Error', 'No se pudo actualizar la cita.');
        return false;
      }
    },
    [loadAppointments, token]
  );

  const deleteAppointment = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) return false;
      try {
        const response = await fetch(`${BASE_URL}/appointments/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ timestamp: toTimestampString() }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || 'No se pudo eliminar la cita.');
        }
        setAppointments(prev => prev.filter(item => item.id !== id));
        return true;
      } catch (error) {
        console.error('Error deleting appointment:', error);
        Alert.alert('Error', 'No se pudo eliminar la cita.');
        return false;
      }
    },
    [token]
  );

  useEffect(() => {
    if (!appointmentsHydrated) {
      return;
    }

    if (!authIsLoading && !userId) {
      setAppointments(prev => (prev.length > 0 ? [] : prev));
      previousUserIdRef.current = null;
      return;
    }

    if (userId && previousUserIdRef.current && previousUserIdRef.current !== userId) {
      setAppointments(prev => (prev.length > 0 ? [] : prev));
    }

    if (userId !== previousUserIdRef.current) {
      previousUserIdRef.current = userId ?? null;
    }
  }, [appointmentsHydrated, authIsLoading, setAppointments, userId]);

  useEffect(() => {
    if (token) {
      loadAppointments();
    }
  }, [loadAppointments, token]);

  const value = useMemo(
    () => ({ appointments, isLoading, loadAppointments, addAppointment, updateAppointment, deleteAppointment }),
    [appointments, isLoading, loadAppointments, addAppointment, updateAppointment, deleteAppointment]
  );

  return <AppointmentsContext.Provider value={value}>{children}</AppointmentsContext.Provider>;
};

