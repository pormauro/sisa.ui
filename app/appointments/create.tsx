import React, { useContext, useEffect, useMemo, useState } from 'react';
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
import FileGallery from '@/components/FileGallery';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatDateForApi, formatTimeForApi } from '@/utils/dateTime';
import { SearchableSelect } from '@/components/SearchableSelect';

const NEW_CLIENT_VALUE = '__new_client__';
const NEW_JOB_VALUE = '__new_job__';

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const formatTimeLabel = (date: Date) =>
  date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function CreateAppointmentScreen() {
  const router = useRouter();
  const { addAppointment } = useContext(AppointmentsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { jobs } = useContext(JobsContext);

  const { date } = useLocalSearchParams<{ date?: string }>();
  const initialDateParam = Array.isArray(date) ? date[0] : date;

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  const [dateTime, setDateTime] = useState<Date>(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    if (initialDateParam) {
      const [year, month, day] = initialDateParam.split('-').map(Number);
      if (
        !Number.isNaN(year) &&
        !Number.isNaN(month) &&
        !Number.isNaN(day)
      ) {
        now.setFullYear(year, month - 1, day);
      }
    }
    return now;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [locationManuallyEdited, setLocationManuallyEdited] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const screenBackground = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#3b314d' }, 'background');
  const borderColor = useThemeColor({ light: '#d0d0d0', dark: '#555' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#bbb' }, 'text');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  useEffect(() => {
    if (!permissions.includes('addAppointment')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para crear visitas.');
      router.back();
    }
  }, [permissions, router]);

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
      return;
    }
    const jobExists = clientJobs.some(job => job.id.toString() === selectedJob);
    if (!jobExists) {
      setSelectedJob('');
    }
  }, [clientJobs, selectedClient, selectedJob]);

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
    if (!selectedClient) {
      setLocation('');
      setLocationManuallyEdited(false);
      return;
    }
    // Reset manual tracking when client changes to allow auto-fill with new data
    setLocationManuallyEdited(false);
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedClient || locationManuallyEdited) return;
    const client = clients.find(item => item.id.toString() === selectedClient);
    if (!client) return;
    setLocation(client.address || '');
  }, [selectedClient, clients, locationManuallyEdited]);

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setLocationManuallyEdited(true);
  };

  const handleSave = async () => {
    if (!selectedClient || !location.trim()) {
      Alert.alert('Campos incompletos', 'Selecciona un cliente e ingresa la ubicación de la visita.');
      return;
    }
    const appointmentDate = formatDateForApi(dateTime);
    const appointmentTime = formatTimeForApi(dateTime);

    setIsSaving(true);
    const result = await addAppointment({
      client_id: Number(selectedClient),
      job_id: selectedJob ? Number(selectedJob) : null,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      location: location.trim(),
      site_image_file_id: null,
      attached_files: attachedFiles || null,
    });
    setIsSaving(false);

    if (result) {
      Alert.alert('Visita creada', 'La visita se registró correctamente.');
      router.back();
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}> 
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                router.push('/clients/create');
                return;
              }
              setSelectedClient(stringValue);
            }}
            placeholder="Selecciona un cliente"
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
                  router.push({ pathname: '/jobs/create', params: { client_id: selectedClient } });
                }
                setSelectedJob('');
                return;
              }
              setSelectedJob(stringValue);
            }}
            placeholder={jobPlaceholder}
            enabled={!!selectedClient}
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
          <FileGallery
            filesJson={attachedFiles}
            onChangeFilesJson={setAttachedFiles}
            editable
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: buttonColor }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={buttonTextColor} />
          ) : (
            <ThemedText style={[styles.saveButtonText, { color: buttonTextColor }]}>Guardar visita</ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
