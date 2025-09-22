import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useCachedState } from '@/hooks/useCachedState';

const NOTIFICATION_SCOPE = 'appointment-reminder';
const NOTIFICATION_CHANNEL_ID = 'appointments';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type AppointmentReminderInput = {
  id: number;
  appointment_date: string;
  appointment_time: string;
};

type NotificationSettings = {
  appointmentRemindersEnabled: boolean;
  appointmentReminderAtTime: boolean;
  appointmentReminderOneHourBefore: boolean;
};

type PermissionStatus = Notifications.PermissionStatus;

type ReminderType = 'atTime' | 'oneHourBefore';

type NotificationsContextValue = {
  settings: NotificationSettings;
  settingsHydrated: boolean;
  permissionStatus: PermissionStatus;
  isPermissionGranted: boolean;
  requestPermissions: () => Promise<boolean>;
  setAppointmentRemindersEnabled: (enabled: boolean) => Promise<boolean>;
  setAppointmentReminderAtTime: (enabled: boolean) => void;
  setAppointmentReminderOneHourBefore: (enabled: boolean) => void;
  syncAppointmentReminders: (appointments: AppointmentReminderInput[]) => Promise<void>;
};

const defaultSettings: NotificationSettings = {
  appointmentRemindersEnabled: false,
  appointmentReminderAtTime: true,
  appointmentReminderOneHourBefore: true,
};

const noopAsync = async () => false;
const noopVoid = () => {};

export const NotificationsContext = createContext<NotificationsContextValue>({
  settings: defaultSettings,
  settingsHydrated: false,
  permissionStatus: 'undetermined',
  isPermissionGranted: false,
  requestPermissions: noopAsync,
  setAppointmentRemindersEnabled: noopAsync,
  setAppointmentReminderAtTime: noopVoid,
  setAppointmentReminderOneHourBefore: noopVoid,
  syncAppointmentReminders: async () => {},
});

const parseAppointmentDateTime = (date: string, time: string): Date | null => {
  if (!date) {
    return null;
  }
  const [year, month, day] = date.split('-').map(Number);
  if ([year, month, day].some(value => Number.isNaN(value))) {
    return null;
  }
  const [hour, minute] = (time ?? '').split(':').map(Number);
  const safeHour = Number.isNaN(hour) ? 0 : hour;
  const safeMinute = Number.isNaN(minute) ? 0 : minute;
  return new Date(year, month - 1, day, safeHour, safeMinute, 0, 0);
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDate = (date: Date) => date.toLocaleDateString();

const buildNotificationContent = (
  appointment: AppointmentReminderInput,
  startDate: Date,
  type: ReminderType
): Notifications.NotificationContentInput => {
  const timeLabel = formatTime(startDate);
  const dateLabel = formatDate(startDate);
  const baseContent: Notifications.NotificationContentInput = {
    title: 'Recordatorio de cita',
    body:
      type === 'oneHourBefore'
        ? `Tienes una cita el ${dateLabel} a las ${timeLabel}.`
        : `Tu cita programada para hoy a las ${timeLabel} comienza ahora.`,
    sound: 'default',
    data: {
      scope: NOTIFICATION_SCOPE,
      appointmentId: appointment.id,
      triggerType: type,
    },
  };
  return baseContent;
};

const scheduleReminder = async (
  appointment: AppointmentReminderInput,
  triggerDate: Date,
  type: ReminderType,
  startDate: Date
) => {
  const trigger: Notifications.NotificationTriggerInput =
    Platform.OS === 'android'
      ? { date: triggerDate, channelId: NOTIFICATION_CHANNEL_ID }
      : triggerDate;

  try {
    await Notifications.scheduleNotificationAsync({
      content: buildNotificationContent(appointment, startDate, type),
      trigger,
    });
  } catch (error) {
    console.warn('Error scheduling appointment reminder notification', error);
  }
};

const clearExistingAppointmentReminders = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const reminders = scheduled.filter(request => request.content?.data?.scope === NOTIFICATION_SCOPE);
    await Promise.all(reminders.map(request => Notifications.cancelScheduledNotificationAsync(request.identifier)));
  } catch (error) {
    console.warn('Error clearing appointment reminder notifications', error);
  }
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings, settingsHydrated] = useCachedState<NotificationSettings>(
    'notificationSettings',
    defaultSettings
  );
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const permissions = await Notifications.getPermissionsAsync();
        if (isMounted) {
          setPermissionStatus(permissions.status);
        }
      } catch (error) {
        console.warn('Error retrieving notification permissions', error);
      }
    })();

    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Recordatorios de citas',
        description: 'Avisos de citas programadas',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      const response = await Notifications.requestPermissionsAsync();
      setPermissionStatus(response.status);
      if (response.status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'Debes habilitar las notificaciones en los ajustes del dispositivo para recibir recordatorios.'
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions', error);
      Alert.alert('Error', 'No se pudieron solicitar los permisos de notificaciones.');
      return false;
    }
  }, []);

  const ensurePermissions = useCallback(async () => {
    if (permissionStatus === 'granted') {
      return true;
    }
    return requestPermissions();
  }, [permissionStatus, requestPermissions]);

  const setAppointmentRemindersEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const granted = await ensurePermissions();
        if (!granted) {
          return false;
        }
      }
      setSettings(prev => ({ ...prev, appointmentRemindersEnabled: enabled }));
      return true;
    },
    [ensurePermissions, setSettings]
  );

  const setAppointmentReminderAtTime = useCallback(
    (enabled: boolean) => {
      setSettings(prev => ({ ...prev, appointmentReminderAtTime: enabled }));
    },
    [setSettings]
  );

  const setAppointmentReminderOneHourBefore = useCallback(
    (enabled: boolean) => {
      setSettings(prev => ({ ...prev, appointmentReminderOneHourBefore: enabled }));
    },
    [setSettings]
  );

  const syncAppointmentReminders = useCallback(
    async (appointments: AppointmentReminderInput[]) => {
      if (!settingsHydrated) {
        return;
      }

      await clearExistingAppointmentReminders();

      if (!settings.appointmentRemindersEnabled) {
        return;
      }

      if (!settings.appointmentReminderAtTime && !settings.appointmentReminderOneHourBefore) {
        return;
      }

      if (permissionStatus !== 'granted') {
        return;
      }

      const now = new Date();

      for (const appointment of appointments) {
        const startDate = parseAppointmentDateTime(appointment.appointment_date, appointment.appointment_time);
        if (!startDate) {
          continue;
        }

        if (settings.appointmentReminderOneHourBefore) {
          const oneHourBefore = new Date(startDate.getTime() - 60 * 60 * 1000);
          if (oneHourBefore.getTime() > now.getTime()) {
            await scheduleReminder(appointment, oneHourBefore, 'oneHourBefore', startDate);
          }
        }

        if (settings.appointmentReminderAtTime && startDate.getTime() > now.getTime()) {
          await scheduleReminder(appointment, startDate, 'atTime', startDate);
        }
      }
    },
    [permissionStatus, settings, settingsHydrated]
  );

  const value = useMemo(
    () => ({
      settings,
      settingsHydrated,
      permissionStatus,
      isPermissionGranted: permissionStatus === 'granted',
      requestPermissions,
      setAppointmentRemindersEnabled,
      setAppointmentReminderAtTime,
      setAppointmentReminderOneHourBefore,
      syncAppointmentReminders,
    }),
    [
      permissionStatus,
      requestPermissions,
      setAppointmentRemindersEnabled,
      setAppointmentReminderAtTime,
      setAppointmentReminderOneHourBefore,
      settings,
      settingsHydrated,
      syncAppointmentReminders,
    ]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

