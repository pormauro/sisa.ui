import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Calendar, DateObject, LocaleConfig } from 'react-native-calendars';
import { ClientsContext } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { AppointmentsContext, Appointment } from '@/contexts/AppointmentsContext';
import { JobsContext, Job } from '@/contexts/JobsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

LocaleConfig.locales.es = {
  monthNames: [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

const today = new Date().toISOString().split('T')[0];

const normalizeParam = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? '';
};

const toDateTimeValue = (date: string, time?: string | null) => {
  const normalizedTime = time && time.length === 5 ? `${time}:00` : time ?? '00:00:00';
  return new Date(`${date}T${normalizedTime}`);
};

const toHourMinute = (value?: string | null) => {
  if (!value) return '';
  return value.length >= 5 ? value.slice(0, 5) : value;
};

const getJobTimeRange = (job: Job) => {
  const start = toHourMinute(job.start_time);
  const end = toHourMinute(job.end_time);
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end || 'Sin horario';
};

const getAppointmentTime = (appointment: Appointment) => {
  const time = toHourMinute(appointment.appointment_time);
  return time || 'Sin horario';
};

type CombinedEvent =
  | { type: 'job'; item: Job }
  | { type: 'appointment'; item: Appointment };

export default function ClientCalendarScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const clientIdParam = normalizeParam(id);
  const clientId = Number(clientIdParam);

  const { clients } = useContext(ClientsContext);
  const { permissions } = useContext(PermissionsContext);
  const { appointments, loadAppointments, isLoading: isLoadingAppointments } = useContext(AppointmentsContext);
  const { jobs, loadJobs } = useContext(JobsContext);

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [refreshing, setRefreshing] = useState(false);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#3b314d' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedTextColor = useThemeColor({ light: '#6c6c6c', dark: '#bbb' }, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const appointmentDotColor = useThemeColor({ light: '#00897B', dark: '#4DB6AC' }, 'tint');
  const jobDotColor = useThemeColor({ light: '#F9A825', dark: '#FFD54F' }, 'tint');
  const addAppointmentButtonColor = useThemeColor({ light: '#00796B', dark: '#26A69A' }, 'button');
  const addJobButtonColor = useThemeColor({ light: '#E65100', dark: '#FFB74D' }, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');

  const canViewAppointments = permissions.includes('listAppointments');
  const canViewJobs = permissions.includes('listJobs');
  const canCreateAppointment = permissions.includes('addAppointment');
  const canCreateJob = permissions.includes('addJob');

  const client = clients.find(item => item.id === clientId);

  useEffect(() => {
    if (Number.isNaN(clientId)) {
      Alert.alert('Cliente no válido', 'No se recibió un identificador de cliente.');
      router.back();
    }
  }, [clientId, router]);

  useEffect(() => {
    if (!client && clients.length > 0) {
      Alert.alert('Cliente no encontrado', 'No pudimos cargar los datos de este cliente.');
      router.back();
    }
  }, [client, clients.length, router]);

  useEffect(() => {
    if (!canViewAppointments && !canViewJobs) {
      Alert.alert('Acceso denegado', 'No tienes permisos para ver la agenda del cliente.');
      router.back();
    }
  }, [canViewAppointments, canViewJobs, router]);

  useFocusEffect(
    useCallback(() => {
      if (canViewAppointments) {
        void loadAppointments();
      }
      if (canViewJobs) {
        void loadJobs();
      }
    }, [canViewAppointments, canViewJobs, loadAppointments, loadJobs])
  );

  const clientAppointments = useMemo(() => {
    if (!canViewAppointments) {
      return [];
    }
    return appointments.filter(item => item.client_id === clientId);
  }, [appointments, canViewAppointments, clientId]);

  const clientJobs = useMemo(() => {
    if (!canViewJobs) {
      return [];
    }
    return jobs.filter(item => item.client_id === clientId && item.job_date);
  }, [jobs, canViewJobs, clientId]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, { jobs: Job[]; appointments: Appointment[] }> = {};
    clientJobs.forEach(job => {
      if (!job.job_date) return;
      if (!map[job.job_date]) {
        map[job.job_date] = { jobs: [], appointments: [] };
      }
      map[job.job_date].jobs.push(job);
    });
    clientAppointments.forEach(appointment => {
      const date = appointment.appointment_date;
      if (!map[date]) {
        map[date] = { jobs: [], appointments: [] };
      }
      map[date].appointments.push(appointment);
    });
    return map;
  }, [clientAppointments, clientJobs]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    Object.entries(eventsByDate).forEach(([date, entry]) => {
      const dots = [] as { key: string; color: string }[];
      if (entry.jobs.length > 0) {
        dots.push({ key: `${date}-jobs`, color: jobDotColor });
      }
      if (entry.appointments.length > 0) {
        dots.push({ key: `${date}-appointments`, color: appointmentDotColor });
      }
      if (dots.length > 0) {
        marks[date] = {
          marked: true,
          dots,
        };
      }
    });
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: tintColor,
      selectedTextColor: '#ffffff',
    };
    return marks;
  }, [appointmentDotColor, eventsByDate, jobDotColor, selectedDate, tintColor]);

  const selectedEvents = useMemo(
    () => eventsByDate[selectedDate] ?? { jobs: [], appointments: [] },
    [eventsByDate, selectedDate]
  );

  const combinedEvents = useMemo(() => {
    const list: CombinedEvent[] = [];
    selectedEvents.jobs.forEach(job => list.push({ type: 'job', item: job }));
    selectedEvents.appointments.forEach(appointment => list.push({ type: 'appointment', item: appointment }));
    return list.sort((a, b) => {
      const aDate = a.type === 'job'
        ? toDateTimeValue(a.item.job_date ?? selectedDate, a.item.start_time).getTime()
        : toDateTimeValue(a.item.appointment_date, a.item.appointment_time).getTime();
      const bDate = b.type === 'job'
        ? toDateTimeValue(b.item.job_date ?? selectedDate, b.item.start_time).getTime()
        : toDateTimeValue(b.item.appointment_date, b.item.appointment_time).getTime();
      return aDate - bDate;
    });
  }, [selectedEvents, selectedDate]);

  const onDayPress = useCallback((day: DateObject) => {
    setSelectedDate(day.dateString);
  }, []);

  const selectedDateLabel = useMemo(() => {
    const parsed = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return selectedDate;
    }
    return parsed.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  const handleEventPress = useCallback(
    (event: CombinedEvent) => {
      if (event.type === 'job') {
        router.push(`/jobs/viewModal?id=${event.item.id}`);
        return;
      }
      router.push(`/appointments/viewModal?id=${event.item.id}`);
    },
    [router]
  );

  const handleAddAppointment = useCallback(() => {
    if (!clientIdParam) {
      router.push({ pathname: '/appointments/create', params: { date: selectedDate } });
      return;
    }
    router.push({ pathname: '/appointments/create', params: { date: selectedDate, client_id: clientIdParam } });
  }, [clientIdParam, router, selectedDate]);

  const handleAddJob = useCallback(() => {
    if (!clientIdParam) {
      router.push({ pathname: '/jobs/create', params: { job_date: selectedDate } });
      return;
    }
    router.push({ pathname: '/jobs/create', params: { client_id: clientIdParam, job_date: selectedDate } });
  }, [clientIdParam, router, selectedDate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (canViewAppointments) {
      await loadAppointments();
    }
    if (canViewJobs) {
      await Promise.resolve(loadJobs());
    }
    setRefreshing(false);
  }, [canViewAppointments, canViewJobs, loadAppointments, loadJobs]);

  if (!client || Number.isNaN(clientId)) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: background }]}>
        <ThemedText>Cliente no disponible</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={styles.title}>Calendario A de {client.business_name}</ThemedText>
      <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>Consulta los trabajos y turnos registrados para este cliente.</ThemedText>
      <Calendar
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={onDayPress}
        initialDate={selectedDate}
        style={[styles.calendar, { borderColor }]}
        theme={{
          backgroundColor: background,
          calendarBackground: background,
          dayTextColor: textColor,
          monthTextColor: textColor,
          selectedDayBackgroundColor: tintColor,
          selectedDayTextColor: '#ffffff',
          todayTextColor: tintColor,
          arrowColor: tintColor,
        }}
      />
      {isLoadingAppointments ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={tintColor} />
        </View>
      ) : null}
      <FlatList
        data={combinedEvents}
        keyExtractor={item => `${item.type}-${item.item.id}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.eventCard, { backgroundColor: cardBackground, borderColor }]}
            onPress={() => handleEventPress(item)}
            activeOpacity={0.85}
          >
            <View style={styles.eventHeader}>
              <ThemedText style={styles.eventType}>
                {item.type === 'job' ? 'Trabajo' : 'Turno'}
              </ThemedText>
              <ThemedText style={[styles.eventTime, { color: mutedTextColor }]}>
                {item.type === 'job'
                  ? getJobTimeRange(item.item)
                  : getAppointmentTime(item.item)}
              </ThemedText>
            </View>
            <ThemedText style={styles.eventTitle} numberOfLines={2}>
              {item.type === 'job'
                ? item.item.description || 'Sin descripción'
                : item.item.location || 'Sin ubicación'}
            </ThemedText>
            {item.type === 'appointment' && item.item.job_id ? (
              <ThemedText style={[styles.eventMeta, { color: mutedTextColor }]}
                numberOfLines={1}
              >
                Trabajo asociado: #{item.item.job_id}
              </ThemedText>
            ) : null}
          </TouchableOpacity>
        )}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <ThemedText style={styles.listHeaderText}>{selectedDateLabel}</ThemedText>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyContainer}>
            <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>No hay trabajos ni turnos para esta fecha.</ThemedText>
          </View>
        )}
        contentContainerStyle={combinedEvents.length === 0 ? styles.emptyContent : styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
      <View style={styles.actionsContainer}>
        {canCreateAppointment && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: addAppointmentButtonColor }]}
            onPress={handleAddAppointment}
          >
            <ThemedText style={[styles.actionButtonText, { color: addButtonTextColor }]}>➕ Agregar turno</ThemedText>
          </TouchableOpacity>
        )}
        {canCreateJob && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: addJobButtonColor }]}
            onPress={handleAddJob}
          >
            <ThemedText style={[styles.actionButtonText, { color: addButtonTextColor }]}>🛠️ Agregar trabajo</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  calendar: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  listHeader: {
    paddingVertical: 8,
  },
  listHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  listContent: {
    paddingBottom: 140,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 140,
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  eventTime: {
    fontSize: 14,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  eventMeta: {
    marginTop: 4,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
