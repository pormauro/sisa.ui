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
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { AppointmentsContext } from '@/contexts/AppointmentsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { JobsContext } from '@/contexts/JobsContext';
import FileGallery from '@/components/FileGallery';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatDateForApi, formatTimeForApi } from '@/utils/dateTime';

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

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  const [dateTime, setDateTime] = useState<Date>(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
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
      Alert.alert('Acceso denegado', 'No tienes permiso para crear citas.');
      router.back();
    }
  }, [permissions, router]);

  const clientJobs = useMemo(() => {
    if (!selectedClient) return jobs;
    const clientId = Number(selectedClient);
    return jobs.filter(job => job.client_id === clientId);
  }, [jobs, selectedClient]);

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

  const handleSave = async () => {
    if (!selectedClient || !location.trim()) {
      Alert.alert('Campos incompletos', 'Selecciona un cliente e ingresa la ubicación de la cita.');
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
      Alert.alert('Cita creada', 'La cita se registró correctamente.', [
        {
          text: 'Aceptar',
          onPress: () => router.back(),
        },
      ]);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: screenBackground }]}> 
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText style={styles.label}>Cliente</ThemedText>
          <View style={[styles.pickerWrapper, { borderColor }]}> 
            <Picker
              selectedValue={selectedClient}
              onValueChange={value => setSelectedClient(value)}
            >
              <Picker.Item label="Selecciona un cliente" value="" />
              {clients.map(client => (
                <Picker.Item
                  key={client.id}
                  label={client.business_name}
                  value={client.id.toString()}
                />
              ))}
            </Picker>
          </View>

          <ThemedText style={styles.label}>Trabajo asociado (opcional)</ThemedText>
          <View style={[styles.pickerWrapper, { borderColor }]}> 
            <Picker
              selectedValue={selectedJob}
              onValueChange={value => setSelectedJob(value)}
            >
              <Picker.Item label="Sin trabajo asociado" value="" />
              {clientJobs.map(job => (
                <Picker.Item key={job.id} label={job.description} value={job.id.toString()} />
              ))}
            </Picker>
          </View>

          <ThemedText style={styles.label}>Fecha de la cita</ThemedText>
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

          <ThemedText style={styles.label}>Hora de la cita</ThemedText>
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
            onChangeText={setLocation}
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
            <ThemedText style={[styles.saveButtonText, { color: buttonTextColor }]}>Guardar cita</ThemedText>
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
  pickerWrapper: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
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
