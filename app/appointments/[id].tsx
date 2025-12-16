import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppointmentsContext } from '@/contexts/AppointmentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { JobsContext } from '@/contexts/JobsContext';
import { FileGallery } from '@/components/FileGallery';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatDateForApi, formatTimeForApi } from '@/utils/dateTime';
import { SearchableSelect } from '@/components/SearchableSelect';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';

const NEW_CLIENT_VALUE = '__new_client__';
const NEW_JOB_VALUE = '__new_job__';

const parseDateTime = (date: string, time: string) => {
  const [hours = '00', minutes = '00'] = time.split(':');
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setHours(Number(hours), Number(minutes), 0, 0);
  return parsed;
};

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const formatTimeLabel = (date: Date) =>
  date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function EditAppointmentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointmentId = Number(id);

  const { appointments, updateAppointment, deleteAppointment, loadAppointments } = useContext(AppointmentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { jobs } = useContext(JobsContext);
  const { beginSelection, consumeSelection, pendingSelections } = usePendingSelection();

  const appointment = appointments.find(item => item.id === appointmentId);

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  const [dateTime, setDateTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [attachedFiles, setAttachedFiles] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const lastSyncedClientRef = useRef<string | null>(null);
  const pendingJobSelectionRef = useRef<string | null>(null);

  const screenBackground = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#3b314d' }, 'background');
  const borderColor = useThemeColor({ light: '#d0d0d0', dark: '#555' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#bbb' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const deleteButtonColor = useThemeColor({ light: '#d9534f', dark: '#ff6b6b' }, 'tint');
  const deleteTextColor = useThemeColor({ light: '#fff', dark: '#2f273e' }, 'background');

  const canEdit = permissions.includes('updateAppointment');
  const canDelete = permissions.includes('deleteAppointment');

  useEffect(() => {
    if (!appointment) {
      loadAppointments();
      return;
    }
    setSelectedClient(appointment.client_id.toString());
    setSelectedJob(appointment.job_id ? appointment.job_id.toString() : '');
    setDateTime(parseDateTime(appointment.appointment_date, appointment.appointment_time));
    const existingLocation = appointment.location || '';
    setLocation(existingLocation);
    lastSyncedClientRef.current = appointment.client_id.toString();
    setAttachedFiles(appointment.attached_files || '');
  }, [appointment, loadAppointments]);

  useEffect(() => {
    if (!canEdit) {
      Alert.alert('Acceso denegado', 'No tienes permiso para editar visitas.');
      router.back();
    }
  }, [canEdit, router]);

  const clientJobs = useMemo(() => {
    if (!selectedClient) return [];
    const clientId = Number(selectedClient);
    return jobs.filter(job => job.client_id === clientId);
  }, [jobs, selectedClient]);

  const clientItems = useMemo(
    () => [
      { label: 'Selecciona un cliente', value: '' },
      { label: '➕ Nuevo cliente', value: NEW_CLIENT_VALUE },
      ...clients.map(client => ({
        label: client.business_name,
        value: client.id.toString(),
      })),
    ],
    [clients]
  );

  const jobPlaceholder = useMemo(
    () =>
      selectedClient
        ? 'Sin trabajo asociado'
        : 'Selecciona un cliente para ver trabajos',
    [selectedClient]
  );

  const jobItems = useMemo(() => {
    const options = [{ label: jobPlaceholder, value: '' }];
    if (selectedClient) {
      options.push({ label: '➕ Nuevo trabajo', value: NEW_JOB_VALUE });
      clientJobs.forEach(job => {
        options.push({ label: job.description, value: job.id.toString() });
      });
    }
    return options;
  }, [clientJobs, jobPlaceholder, selectedClient]);

  useEffect(() => {
    if (!selectedClient) {
      setSelectedJob('');
      pendingJobSelectionRef.current = null;
      return;
    }

    if (!selectedJob) {
      pendingJobSelectionRef.current = null;
      return;
    }

    const jobExists = clientJobs.some(job => job.id.toString() === selectedJob);
    if (jobExists) {
      if (pendingJobSelectionRef.current === selectedJob) {
        pendingJobSelectionRef.current = null;
      }
      return;
    }

    if (pendingJobSelectionRef.current === selectedJob) {
      return;
    }

    setSelectedJob('');
  }, [clientJobs, selectedClient, selectedJob]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.appointments.client)) {
      return;
    }
    const pendingClient = consumeSelection<string>(SELECTION_KEYS.appointments.client);
    if (pendingClient) {
      setSelectedClient(pendingClient.toString());
    }
  }, [pendingSelections, consumeSelection]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.appointments.job)) {
      return;
    }
    const pendingJobId = consumeSelection<string | number>(SELECTION_KEYS.appointments.job);
    if (!pendingJobId && pendingJobId !== 0) {
      return;
    }
    const normalizedId = pendingJobId.toString();
    pendingJobSelectionRef.current = normalizedId;
    setSelectedJob(normalizedId);
  }, [pendingSelections, consumeSelection]);

  const handleChangeDate = (_: any, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (!selected) return;
    const updated = new Date(dateTime);
    updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setDateTime(updated);
  };

  const handleChangeTime = (_: any, selected?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (!selected) return;
    const updated = new Date(dateTime);
    updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setDateTime(updated);
  };

  useEffect(() => {
    if (lastSyncedClientRef.current === null) {
      lastSyncedClientRef.current = selectedClient || null;
      return;
    }
    if (lastSyncedClientRef.current !== selectedClient) {
      lastSyncedClientRef.current = selectedClient || null;
      setLocation('');
    }
  }, [selectedClient]);

  const handleLocationChange = (value: string) => {
    setLocation(value);
  };

  const handleSave = async () => {
    if (!appointment) return;
    if (!selectedClient || !location.trim()) {
      Alert.alert('Campos incompletos', 'Selecciona un cliente e ingresa la ubicación de la visita.');
      return;
    }
    const appointmentDate = formatDateForApi(dateTime);
    const appointmentTime = formatTimeForApi(dateTime);

    setIsSaving(true);
    const ok = await updateAppointment(appointment.id, {
      client_id: Number(selectedClient),
      job_id: selectedJob ? Number(selectedJob) : null,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      location: location.trim(),
      site_image_file_id: null,
      attached_files: attachedFiles || null,
    });
    setIsSaving(false);

    if (ok) {
      Alert.alert('Visita actualizada', 'Los cambios se guardaron correctamente.', [
        {
          text: 'Aceptar',
          onPress: () => router.back(),
        },
      ]);
    }
  };

  const handleDelete = () => {
    if (!appointment || !canDelete) return;
    Alert.alert('Eliminar visita', '¿Seguro que quieres eliminar esta visita?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          const ok = await deleteAppointment(appointment.id);
          setIsDeleting(false);
          if (ok) {
            router.back();
          }
        },
      },
    ]);
  };

  if (!appointment) {
    return (
      <ThemedView style={[styles.loadingContainer, { backgroundColor: screenBackground }]}>
        <ActivityIndicator size="large" color={buttonColor} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}> 
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={styles.label}>Cliente</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={clientItems}
            selectedValue={selectedClient}
            onValueChange={value => {
              const stringValue = value?.toString() ?? '';
              if (stringValue === NEW_CLIENT_VALUE) {
                setSelectedClient('');
                beginSelection(SELECTION_KEYS.appointments.client);
                router.push('/clients/create');
                return;
              }
              setSelectedClient(stringValue);
            }}
            placeholder="Selecciona un cliente"
            disabled={!canEdit}
            onItemLongPress={(item) => {
              const value = String(item.value ?? '');
              if (!value || value === NEW_CLIENT_VALUE) return;
              beginSelection(SELECTION_KEYS.appointments.client);
              router.push(`/clients/${value}`);
            }}
          />

          <ThemedText style={styles.label}>Trabajo asociado (opcional)</ThemedText>
          <SearchableSelect
            style={styles.select}
            items={jobItems}
            selectedValue={selectedJob}
            onValueChange={value => {
              const stringValue = value?.toString() ?? '';
              if (stringValue === NEW_JOB_VALUE) {
                if (selectedClient) {
                  beginSelection(SELECTION_KEYS.appointments.job);
                  router.push({ pathname: '/jobs/create', params: { client_id: selectedClient } });
                }
                setSelectedJob('');
                pendingJobSelectionRef.current = null;
                return;
              }
              setSelectedJob(stringValue);
            }}
            placeholder={jobPlaceholder}
            disabled={!canEdit || !selectedClient}
            onItemLongPress={(item) => {
              const value = String(item.value ?? '');
              if (!value || value === NEW_JOB_VALUE) return;
              beginSelection(SELECTION_KEYS.appointments.job);
              router.push(`/jobs/${value}`);
            }}
          />

          <ThemedText style={styles.label}>Fecha de la visita</ThemedText>
          <TouchableOpacity
            style={[styles.selector, { borderColor }]}
            onPress={() => setShowDatePicker(true)}
          >
            <ThemedText style={styles.selectorText}>{formatDateLabel(dateTime)}</ThemedText>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dateTime}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleChangeDate}
            />
          )}

          <ThemedText style={styles.label}>Hora de la visita</ThemedText>
          <TouchableOpacity
            style={[styles.selector, { borderColor }]}
            onPress={() => setShowTimePicker(true)}
          >
            <ThemedText style={styles.selectorText}>{formatTimeLabel(dateTime)}</ThemedText>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={dateTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleChangeTime}
            />
          )}

          <ThemedText style={styles.label}>Ubicación</ThemedText>
          <TextInput
            style={[styles.input, { borderColor, color: inputTextColor }]}
            value={location}
            onChangeText={handleLocationChange}
            placeholder="Dirección o referencia"
            placeholderTextColor={placeholderColor}
          />

          <ThemedText style={styles.label}>Archivos adjuntos</ThemedText>
          <FileGallery entityType="appointment" entityId={appointmentId} filesJson={attachedFiles} />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: buttonColor }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.saveButtonText, { color: buttonTextColor }]}>Guardar cambios</ThemedText>
          )}
        </TouchableOpacity>

        {canDelete && (
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: deleteButtonColor }]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color={deleteTextColor} />
            ) : (
              <ThemedText style={[styles.deleteText, { color: deleteTextColor }]}>Eliminar visita</ThemedText>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  select: {
    marginBottom: 16,
  },
  selector: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  selectorText: {
    fontSize: 16,
    textTransform: 'capitalize',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  saveButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 28,
    marginBottom: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 28,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
