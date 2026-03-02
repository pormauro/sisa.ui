import React, { useContext, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AppointmentsContext } from '@/contexts/AppointmentsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface JobAppointmentsListProps {
  jobId: number;
  isEditable?: boolean;
}

export function JobAppointmentsList({ jobId, isEditable = false }: JobAppointmentsListProps) {
  const { appointments, deleteAppointment } = useContext(AppointmentsContext);
  const router = useRouter();

  const cardBg = useThemeColor({ light: '#f9f9f9', dark: '#4a415d' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#666' }, 'background');

  const relatedAppointments = useMemo(
    () =>
      appointments
        .filter(app => app.job_id === jobId)
        .sort(
          (a, b) =>
            new Date(b.appointment).getTime() - new Date(a.appointment).getTime()
        ),
    [appointments, jobId]
  );

  const confirmDelete = (appId: number) => {
    Alert.alert('Eliminar', '¿Seguro que quieres borrar esta visita?', [
      { text: 'No' },
      { text: 'Sí, eliminar', style: 'destructive', onPress: () => deleteAppointment(appId) },
    ]);
  };

  const handleLongPress = (appId: number) => {
    if (!isEditable) return;

    Alert.alert('Opciones de cita', '¿Qué deseas hacer con esta visita?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Editar', onPress: () => router.push(`/appointments/${appId}`) },
      { text: 'Eliminar', style: 'destructive', onPress: () => confirmDelete(appId) },
    ]);
  };

  if (relatedAppointments.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText style={{ opacity: 0.6 }}>
          No hay visitas programadas para este trabajo.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {relatedAppointments.map(item => (
        <TouchableOpacity
          key={item.id}
          style={[styles.appointmentCard, { backgroundColor: cardBg, borderColor }]}
          onLongPress={() => handleLongPress(item.id)}
          activeOpacity={isEditable ? 0.7 : 1}
        >
          <View style={styles.content}>
            <ThemedText type="defaultSemiBold">
              {new Date(item.appointment).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              hs
            </ThemedText>
            {item.comment ? (
              <ThemedText style={styles.comment} numberOfLines={1}>
                {item.comment}
              </ThemedText>
            ) : null}
          </View>
          {isEditable ? <ThemedText style={styles.editHint}>(Mantén para editar)</ThemedText> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  empty: { paddingVertical: 12, alignItems: 'center' },
  content: { flex: 1, marginRight: 8 },
  appointmentCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comment: { fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  editHint: { fontSize: 10, opacity: 0.5 },
});

