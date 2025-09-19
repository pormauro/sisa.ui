import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  GestureResponderEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
// eslint-disable-next-line import/no-unresolved
import { Calendar, DateObject, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { AppointmentsContext, Appointment } from '@/contexts/AppointmentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { JobsContext } from '@/contexts/JobsContext';
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

export default function AppointmentsCalendarScreen() {
  const router = useRouter();
  const { appointments, isLoading, loadAppointments, deleteAppointment } = useContext(AppointmentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { jobs } = useContext(JobsContext);

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#3b314d' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const tintColor = useThemeColor({}, 'tint');
  const emptyTextColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');

  const canCreate = permissions.includes('addAppointment');
  const canEdit = permissions.includes('updateAppointment');
  const canDelete = permissions.includes('deleteAppointment');

  useEffect(() => {
    if (!permissions.includes('listAppointments')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver las citas.');
      router.back();
      return;
    }
    loadAppointments();
  }, [permissions, loadAppointments, router]);

  const appointmentsByDate = useMemo(() => {
    return appointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
      if (!acc[appointment.appointment_date]) {
        acc[appointment.appointment_date] = [];
      }
      acc[appointment.appointment_date].push(appointment);
      return acc;
    }, {});
  }, [appointments]);

  const selectedAppointments = useMemo(() => {
    const items = appointmentsByDate[selectedDate] ?? [];
    return [...items].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  }, [appointmentsByDate, selectedDate]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    Object.entries(appointmentsByDate).forEach(([date, items]) => {
      if (items.length > 0) {
        marks[date] = {
          marked: true,
          dots: [{ key: 'appointments', color: tintColor }],
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
  }, [appointmentsByDate, selectedDate, tintColor]);

  const onDayPress = useCallback((day: DateObject) => {
    setSelectedDate(day.dateString);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  }, [loadAppointments]);

  const confirmDelete = useCallback(
    (id: number) => {
      Alert.alert('Eliminar cita', '¿Seguro que quieres eliminar esta cita?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            const ok = await deleteAppointment(id);
            if (!ok) {
              setDeletingId(null);
              return;
            }
            setDeletingId(null);
          },
        },
      ]);
    },
    [deleteAppointment]
  );

  const handleDeletePress = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      confirmDelete(id);
    },
    [confirmDelete]
  );

  const renderItem = useCallback(
    ({ item }: { item: Appointment }) => {
      const client = clients.find(c => c.id === item.client_id);
      const job = item.job_id ? jobs.find(j => j.id === item.job_id) : undefined;
      const appointmentTime = item.appointment_time?.slice(0, 5) || item.appointment_time;
      return (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBackground, borderColor }]}
          onPress={() => router.push(`/appointments/viewModal?id=${item.id}`)}
          onLongPress={() => canEdit && router.push(`/appointments/${item.id}`)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTime}>{appointmentTime}</ThemedText>
            <ThemedText style={styles.cardLocation}>{item.location || 'Sin ubicación'}</ThemedText>
          </View>
          <ThemedText style={styles.cardTitle} numberOfLines={1}>
            {client?.business_name || `Cliente #${item.client_id}`}
          </ThemedText>
          {job?.description ? (
            <ThemedText style={styles.cardSubtitle} numberOfLines={1}>
              {job.description}
            </ThemedText>
          ) : null}
          {canDelete ? (
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={event => handleDeletePress(event, item.id)}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color={tintColor} />
                ) : (
                  <ThemedText style={styles.deleteIcon}>🗑️</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [borderColor, cardBackground, canDelete, canEdit, clients, deletingId, handleDeletePress, jobs, router, tintColor]
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}> 
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
      {isLoading && !refreshing ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={tintColor} />
        </View>
      ) : null}
      <FlatList
        data={selectedAppointments}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText style={[styles.emptyText, { color: emptyTextColor }]}>No hay citas programadas</ThemedText>
          </View>
        }
        contentContainerStyle={[styles.listContent, selectedAppointments.length === 0 && styles.listEmpty]}
      />
      {canCreate && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/appointments/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Nueva cita</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 80,
  },
  calendar: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 120,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardLocation: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  cardActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  deleteIcon: {
    fontSize: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 2,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
