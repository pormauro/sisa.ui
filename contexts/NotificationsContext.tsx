import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useCachedState } from '@/hooks/useCachedState';
import type { Appointment } from '@/contexts/AppointmentsContext';

type NotificationPreferences = {
  appointmentAtTime: boolean;
  appointmentOneHourBefore: boolean;
};

type ScheduledNotificationInfo = {
  id: string;
  scheduledFor: string;
};

type AppointmentNotificationRecord = {
  atTime?: ScheduledNotificationInfo;
  oneHourBefore?: ScheduledNotificationInfo;
};

type ScheduledNotificationsState = Record<number, AppointmentNotificationRecord>;

type EnsurePermissionsOptions = {
  silent?: boolean;
};

interface NotificationsContextValue {
  preferences: NotificationPreferences;
  updatePreferences: (changes: Partial<NotificationPreferences>) => Promise<boolean>;
  permissionStatus: Notifications.NotificationPermissionsStatus | null;
  ensurePermissions: (options?: EnsurePermissionsOptions) => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  scheduleAppointmentNotifications: (appointment: Appointment) => Promise<void>;
  cancelAppointmentNotifications: (appointmentId: number) => Promise<void>;
  syncAppointments: (appointments: Appointment[]) => Promise<void>;
  isReady: boolean;
}

const defaultPreferences: NotificationPreferences = {
  appointmentAtTime: true,
  appointmentOneHourBefore: true,
};

const noopAsync = async () => {};

export const NotificationsContext = createContext<NotificationsContextValue>({
  preferences: defaultPreferences,
  updatePreferences: async () => false,
  permissionStatus: null,
  ensurePermissions: async () => false,
  requestPermissions: async () => false,
  scheduleAppointmentNotifications: noopAsync,
  cancelAppointmentNotifications: noopAsync,
  syncAppointments: noopAsync,
  isReady: false,
});

const NOTIFICATION_PREFS_KEY = 'notification:preferences';
const NOTIFICATION_SCHEDULES_KEY = 'notification:schedules';
const ANDROID_CHANNEL_ID = 'appointments';

const formatDateTime = (date: Date): { date: string; time: string } => {
  try {
    const dateLabel = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeLabel = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { date: dateLabel, time: timeLabel };
  } catch (error) {
    console.log('Error formatting date', error);
    const timeLabel = `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    return { date: date.toISOString().split('T')[0] ?? '', time: timeLabel };
  }
};

const normalizeTime = (time: string): string => {
  if (time.includes(':')) {
    const segments = time.split(':');
    if (segments.length >= 2) {
      const [hours, minutes, seconds] = segments;
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${(seconds ?? '00').padStart(2, '0')}`;
    }
  }
  return `${time}:00`;
};

const buildAppointmentDate = (appointment: Appointment): Date | null => {
  if (!appointment.appointment_date || !appointment.appointment_time) {
    return null;
  }
  const normalizedTime = normalizeTime(appointment.appointment_time);
  const isoString = `${appointment.appointment_date}T${normalizedTime}`;
  const target = new Date(isoString);
  if (Number.isNaN(target.getTime())) {
    return null;
  }
  return target;
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [preferences, setPreferences, preferencesHydrated] = useCachedState<NotificationPreferences>(
    NOTIFICATION_PREFS_KEY,
    defaultPreferences
  );
  const [scheduledNotifications, setScheduledNotifications, schedulesHydrated] = useCachedState<
    ScheduledNotificationsState
  >(NOTIFICATION_SCHEDULES_KEY, {});
  const scheduledRef = useRef<ScheduledNotificationsState>(scheduledNotifications);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.NotificationPermissionsStatus | null>(null);

  useEffect(() => {
    scheduledRef.current = scheduledNotifications;
  }, [scheduledNotifications]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Recordatorios de citas',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const status = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
      } catch (error) {
        console.log('Error obteniendo permisos de notificaciones', error);
      }
    })();
  }, []);

  const isReady = preferencesHydrated && schedulesHydrated;

  const ensurePermissions = useCallback(
    async ({ silent = false }: EnsurePermissionsOptions = {}): Promise<boolean> => {
      try {
        const currentStatus = await Notifications.getPermissionsAsync();
        setPermissionStatus(currentStatus);
        if (currentStatus.granted) {
          return true;
        }
        if (silent) {
          return false;
        }
        const requestedStatus = await Notifications.requestPermissionsAsync();
        setPermissionStatus(requestedStatus);
        if (!requestedStatus.granted && !silent) {
          Alert.alert(
            'Permiso requerido',
            'Activa las notificaciones del sistema para recibir recordatorios de tus citas.'
          );
        }
        return requestedStatus.granted;
      } catch (error) {
        console.log('Error al verificar permisos de notificaciones', error);
        if (!silent) {
          Alert.alert('Error', 'No se pudieron verificar los permisos de notificaciones.');
        }
        return false;
      }
    },
    []
  );

  const requestPermissions = useCallback(async () => ensurePermissions({ silent: false }), [ensurePermissions]);

  const cancelAppointmentNotifications = useCallback(
    async (appointmentId: number) => {
      const existing = scheduledRef.current[appointmentId];
      if (!existing) {
        return;
      }

      const nextState: ScheduledNotificationsState = { ...scheduledRef.current };

      const cancelById = async (id: string | undefined) => {
        if (!id) return;
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (error) {
          console.log('Error cancelando notificación programada', error);
        }
      };

      await cancelById(existing.atTime?.id);
      await cancelById(existing.oneHourBefore?.id);

      delete nextState[appointmentId];
      scheduledRef.current = nextState;
      setScheduledNotifications(nextState);
    },
    [setScheduledNotifications]
  );

  const scheduleNotification = useCallback(
    async (appointment: Appointment, targetDate: Date, message: string) => {
      const trigger: Notifications.DateTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      };

      try {
        return await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Recordatorio de cita',
            body: message,
            data: { appointmentId: appointment.id },
            sound: 'default',
          },
          trigger,
        });
      } catch (error) {
        console.log('Error programando recordatorio de cita', error);
        return null;
      }
    },
    []
  );

  const scheduleAppointmentNotifications = useCallback(
    async (appointment: Appointment) => {
      if (!isReady) {
        return;
      }

      const appointmentDate = buildAppointmentDate(appointment);
      if (!appointmentDate) {
        return;
      }

      const shouldSchedule = preferences.appointmentAtTime || preferences.appointmentOneHourBefore;
      if (shouldSchedule) {
        const granted = await ensurePermissions({ silent: true });
        if (!granted) {
          return;
        }
      }

      const existing = scheduledRef.current[appointment.id];
      const nextRecord: AppointmentNotificationRecord = {};
      const now = new Date();
      let stateChanged = false;

      const cancelById = async (id: string | undefined) => {
        if (!id) return;
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (error) {
          console.log('Error cancelando notificación programada', error);
        }
      };

      const { date: dateLabel, time: timeLabel } = formatDateTime(appointmentDate);

      if (preferences.appointmentAtTime) {
        if (appointmentDate > now) {
          const scheduledFor = appointmentDate.toISOString();
          if (existing?.atTime?.scheduledFor !== scheduledFor) {
            await cancelById(existing?.atTime?.id);
            const notificationId = await scheduleNotification(
              appointment,
              appointmentDate,
              `Tu cita programada para hoy (${dateLabel} a las ${timeLabel}) está comenzando ahora.`
            );
            if (notificationId) {
              nextRecord.atTime = { id: notificationId, scheduledFor };
              stateChanged = true;
            }
          } else if (existing?.atTime) {
            nextRecord.atTime = existing.atTime;
          }
        } else if (existing?.atTime) {
          await cancelById(existing.atTime.id);
          stateChanged = true;
        }
      } else if (existing?.atTime) {
        await cancelById(existing.atTime.id);
        stateChanged = true;
      }

      if (preferences.appointmentOneHourBefore) {
        const oneHourBefore = new Date(appointmentDate.getTime() - 60 * 60 * 1000);
        if (oneHourBefore > now) {
          const scheduledFor = oneHourBefore.toISOString();
          if (existing?.oneHourBefore?.scheduledFor !== scheduledFor) {
            await cancelById(existing?.oneHourBefore?.id);
            const notificationId = await scheduleNotification(
              appointment,
              oneHourBefore,
              `Falta 1 hora para tu cita de hoy (${dateLabel} a las ${timeLabel}).`
            );
            if (notificationId) {
              nextRecord.oneHourBefore = { id: notificationId, scheduledFor };
              stateChanged = true;
            }
          } else if (existing?.oneHourBefore) {
            nextRecord.oneHourBefore = existing.oneHourBefore;
          }
        } else if (existing?.oneHourBefore) {
          await cancelById(existing.oneHourBefore.id);
          stateChanged = true;
        }
      } else if (existing?.oneHourBefore) {
        await cancelById(existing.oneHourBefore.id);
        stateChanged = true;
      }

      if (!nextRecord.atTime && existing?.atTime) {
        stateChanged = true;
      }
      if (!nextRecord.oneHourBefore && existing?.oneHourBefore) {
        stateChanged = true;
      }

      const hasAnyNotification = !!nextRecord.atTime || !!nextRecord.oneHourBefore;

      if (!hasAnyNotification) {
        if (existing) {
          const updatedState: ScheduledNotificationsState = { ...scheduledRef.current };
          delete updatedState[appointment.id];
          scheduledRef.current = updatedState;
          setScheduledNotifications(updatedState);
        }
        return;
      }

      const previous = scheduledRef.current[appointment.id];
      const isDifferent =
        (previous?.atTime?.id ?? null) !== (nextRecord.atTime?.id ?? null) ||
        (previous?.atTime?.scheduledFor ?? null) !== (nextRecord.atTime?.scheduledFor ?? null) ||
        (previous?.oneHourBefore?.id ?? null) !== (nextRecord.oneHourBefore?.id ?? null) ||
        (previous?.oneHourBefore?.scheduledFor ?? null) !== (nextRecord.oneHourBefore?.scheduledFor ?? null);

      if (isDifferent || stateChanged || !previous) {
        const updatedState: ScheduledNotificationsState = {
          ...scheduledRef.current,
          [appointment.id]: nextRecord,
        };
        scheduledRef.current = updatedState;
        setScheduledNotifications(updatedState);
      }
    },
    [
      ensurePermissions,
      isReady,
      preferences.appointmentAtTime,
      preferences.appointmentOneHourBefore,
      scheduleNotification,
      setScheduledNotifications,
    ]
  );

  const syncAppointments = useCallback(
    async (appointments: Appointment[]) => {
      if (!isReady) {
        return;
      }

      const existingIds = new Set(Object.keys(scheduledRef.current).map(id => Number(id)));
      const incomingIds = new Set(appointments.map(item => item.id));

      const removals: Promise<void>[] = [];
      existingIds.forEach(id => {
        if (!incomingIds.has(id)) {
          removals.push(cancelAppointmentNotifications(id));
        }
      });
      if (removals.length > 0) {
        await Promise.all(removals);
      }

      if (!preferences.appointmentAtTime && !preferences.appointmentOneHourBefore) {
        if (existingIds.size > 0) {
          const disablePromises = Array.from(existingIds).map(id => cancelAppointmentNotifications(id));
          await Promise.all(disablePromises);
        }
        return;
      }

      for (const appointment of appointments) {
        // eslint-disable-next-line no-await-in-loop
        await scheduleAppointmentNotifications(appointment);
      }
    },
    [
      cancelAppointmentNotifications,
      isReady,
      preferences.appointmentAtTime,
      preferences.appointmentOneHourBefore,
      scheduleAppointmentNotifications,
    ]
  );

  const updatePreferences = useCallback(
    async (changes: Partial<NotificationPreferences>) => {
      if (!isReady) {
        return false;
      }

      const nextPreferences = { ...preferences, ...changes };
      const enablingAtTime = changes.appointmentAtTime === true && !preferences.appointmentAtTime;
      const enablingHourBefore =
        changes.appointmentOneHourBefore === true && !preferences.appointmentOneHourBefore;

      if (
        (nextPreferences.appointmentAtTime || nextPreferences.appointmentOneHourBefore) &&
        (!preferences.appointmentAtTime && !preferences.appointmentOneHourBefore)
      ) {
        const granted = await ensurePermissions({ silent: false });
        if (!granted) {
          return false;
        }
      } else if (enablingAtTime || enablingHourBefore) {
        const granted = await ensurePermissions({ silent: false });
        if (!granted) {
          return false;
        }
      }

      setPreferences(nextPreferences);
      return true;
    },
    [ensurePermissions, isReady, preferences, setPreferences]
  );

  const value = useMemo(
    () => ({
      preferences,
      updatePreferences,
      permissionStatus,
      ensurePermissions,
      requestPermissions,
      scheduleAppointmentNotifications,
      cancelAppointmentNotifications,
      syncAppointments,
      isReady,
    }),
    [
      cancelAppointmentNotifications,
      ensurePermissions,
      isReady,
      permissionStatus,
      preferences,
      requestPermissions,
      scheduleAppointmentNotifications,
      syncAppointments,
      updatePreferences,
    ]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

