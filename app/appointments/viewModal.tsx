import React, { useContext, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppointmentsContext } from '@/contexts/AppointmentsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { JobsContext } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FileGallery } from '@/components/FileGallery';

const parseDateTime = (date: string, time: string) => {
  const [hours = '00', minutes = '00'] = time.split(':');
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setHours(Number(hours), Number(minutes), 0, 0);
  return parsed;
};

export default function ViewAppointmentModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointmentId = Number(id);

  const { appointments } = useContext(AppointmentsContext);
  const { clients } = useContext(ClientsContext);
  const { jobs } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const labelColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');

  const appointment = appointments.find(item => item.id === appointmentId);

  const appointmentDate = useMemo(() => {
    if (!appointment) return '';
    const dt = parseDateTime(appointment.appointment_date, appointment.appointment_time);
    return dt.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [appointment]);

  const appointmentTime = useMemo(() => {
    if (!appointment) return '';
    const dt = parseDateTime(appointment.appointment_date, appointment.appointment_time);
    return dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }, [appointment]);

  const clientName = useMemo(() => {
    if (!appointment) return 'Sin cliente';
    return clients.find(client => client.id === appointment.client_id)?.business_name || 'Sin cliente';
  }, [appointment, clients]);

  const jobDescription = useMemo(() => {
    if (!appointment || !appointment.job_id) return null;
    return jobs.find(job => job.id === appointment.job_id)?.description || null;
  }, [appointment, jobs]);

  if (!appointment) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background }]}> 
        <ThemedText>Cita no encontrada</ThemedText>
      </ThemedView>
    );
  }

  const canEdit = permissions.includes('updateAppointment');

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}> 
      <ThemedText style={[styles.label, { color: labelColor }]}>Fecha</ThemedText>
      <ThemedText style={styles.value}>{appointmentDate}</ThemedText>

      <ThemedText style={[styles.label, { color: labelColor }]}>Hora</ThemedText>
      <ThemedText style={styles.value}>{appointmentTime}</ThemedText>

      <ThemedText style={[styles.label, { color: labelColor }]}>Cliente</ThemedText>
      <ThemedText style={styles.value}>{clientName}</ThemedText>

      {jobDescription ? (
        <>
          <ThemedText style={[styles.label, { color: labelColor }]}>Trabajo asociado</ThemedText>
          <ThemedText style={styles.value}>{jobDescription}</ThemedText>
        </>
      ) : null}

      <ThemedText style={[styles.label, { color: labelColor }]}>Ubicación</ThemedText>
      <ThemedText style={styles.value}>{appointment.location || 'Sin ubicación'}</ThemedText>

      <View style={styles.filesSection}>
        <ThemedText style={[styles.label, { color: labelColor }]}>Archivos adjuntos</ThemedText>
        <FileGallery
          entityType="appointment"
          entityId={appointment.id}
          filesJson={appointment.attached_files ?? null}
        />
      </View>

      <ThemedText style={[styles.label, { color: labelColor }]}>ID</ThemedText>
      <ThemedText style={styles.value}>{appointment.id}</ThemedText>

      {canEdit ? (
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: buttonColor }]}
          onPress={() => router.push(`/appointments/${appointment.id}`)}
        >
          <ThemedText style={[styles.editButtonText, { color: buttonTextColor }]}>Editar cita</ThemedText>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    textTransform: 'uppercase',
    marginTop: 16,
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  filesSection: {
    marginTop: 8,
  },
  editButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
