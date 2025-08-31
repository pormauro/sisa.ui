// C:/Users/Mauri/Documents/GitHub/router/app/jobs/[id].tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import FileCarousel from '@/components/FileCarousel';
import { JobsContext } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { ModalPicker, ModalPickerItem } from '@/components/ModalPicker';

export default function EditJobScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);

  const { jobs, updateJob, deleteJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { folders } = useContext(FoldersContext);

  const job = jobs.find(j => j.id === jobId);
  const canEdit   = permissions.includes('updateJob');
  const canDelete = permissions.includes('deleteJob');

  // estados para pickers
  const [selectedClient,  setSelectedClient]  = useState<ModalPickerItem | null>(null);
  const [selectedFolder,  setSelectedFolder]  = useState<ModalPickerItem | null>(null);

  // otros campos
  const [description,   setDescription] = useState('');
  const [attachedFiles, setAttachedFiles] = useState('');
  const [jobDate,       setJobDate] = useState('');
  const [startTime,     setStartTime] = useState('');
  const [endTime,       setEndTime] = useState('');
  const [showDatePicker,      setShowDatePicker]   = useState(false);
  const [showStartPicker,     setShowStartPicker]  = useState(false);
  const [showEndPicker,       setShowEndPicker]    = useState(false);

  const [loading, setLoading] = useState(false);

  // carga inicial del job
  useEffect(() => {
    if (!job) {
      Alert.alert('Error', 'Trabajo no encontrado.');
      router.back();
      return;
    }
    // cargar pickers
    const cli = clients.find(c => c.id === job.client_id);
    setSelectedClient(cli ? { id: cli.id, name: cli.business_name } : null);

    const fol = folders.find(f => f.id === job.folder_id);
    setSelectedFolder(fol ? { id: fol.id, name: fol.name } : null);

    const extractDate = (dt?: string) => (dt && dt.includes(' ') ? dt.split(' ')[0] : dt || '');
    const extractTime = (dt?: string) => (dt && dt.includes(' ') ? dt.split(' ')[1].slice(0,5) : dt || '');

    setDescription(job.description || '');
    setAttachedFiles(job.attached_files || '');
    setJobDate(extractDate(job.job_date));
    setStartTime(extractTime(job.start_time));
    setEndTime(extractTime(job.end_time));
  }, [job, clients, folders]);

  // opciones para pickers
  const clientItems = useMemo(
    () => clients.map(c => ({ id: c.id, name: c.business_name })),
    [clients]
  );
  const folderItems = useMemo(
    () => folders
      .filter(f => selectedClient?.id === f.client_id)
      .map(f => ({ id: f.id, name: f.name })),
    [folders, selectedClient]
  );

  // submit
  const handleSubmit = async () => {
    if (!selectedClient || !description || !jobDate || !startTime || !endTime) {
      Alert.alert('Error', 'Completa los campos obligatorios.');
      return;
    }
    setLoading(true);
    const startDateTime = `${jobDate} ${startTime}:00`;
    const endDateTime = `${jobDate} ${endTime}:00`;
    const updated = await updateJob(jobId, {
      client_id: Number(selectedClient.id),
      description,
      start_time: startDateTime,
      end_time: endDateTime,
      tariff_id: null,
      manual_amount: null,
      attached_files: attachedFiles || null,
      folder_id: selectedFolder ? Number(selectedFolder.id) : null,
      job_date: startDateTime,
    });
    setLoading(false);

    if (updated) {
      Alert.alert('Éxito', 'Trabajo actualizado.');
      router.back();
    } else {
      Alert.alert('Error', 'No se pudo actualizar el trabajo.');
    }
  };

  // delete
  const handleDelete = () => {
    Alert.alert('Eliminar trabajo', '¿Deseas eliminar este trabajo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const success = await deleteJob(jobId);
          setLoading(false);
          if (success) {
            Alert.alert('Éxito', 'Trabajo eliminado.');
            router.back();
          } else {
            Alert.alert('Error', 'No se pudo eliminar el trabajo.');
          }
        }
      }
    ]);
  };

  // renderiza TODO el formulario en el header de FlatList
  const renderForm = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      {/* Descripción */}
      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        multiline
        value={description}
        onChangeText={setDescription}
        editable={canEdit}
      />

      {/* Cliente */}
      <Text style={styles.label}>Cliente *</Text>
      <View style={styles.pickerWrap}>
        <ModalPicker
          items={clientItems}
          selectedItem={selectedClient}
          onSelect={setSelectedClient}
          placeholder="-- Cliente --"
        />
      </View>

      {/* Carpeta */}
      <Text style={styles.label}>Carpeta</Text>
      <View style={styles.pickerWrap}>
        <ModalPicker
          items={folderItems}
          selectedItem={selectedFolder}
          onSelect={setSelectedFolder}
          placeholder="-- Carpeta --"
        />
      </View>

      {/* Fecha del trabajo */}
      <Text style={styles.label}>Fecha</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text>{jobDate || 'Selecciona fecha'}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={jobDate ? new Date(jobDate) : new Date()}
          mode="date"
          display="default"
          onChange={(e, selected) => {
            setShowDatePicker(false);
            if (selected) {
              const d = selected.toISOString().split('T')[0];
              setJobDate(d);
            }
          }}
        />
      )}

      {/* Hora de inicio */}
      <Text style={styles.label}>Hora inicio</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
        <Text>{startTime || 'Selecciona hora de inicio'}</Text>
      </TouchableOpacity>
      {showStartPicker && (
        <DateTimePicker
          value={startTime ? new Date(`1970-01-01T${startTime}`) : new Date()}
          mode="time"
          display="default"
          onChange={(e, selected) => {
            setShowStartPicker(false);
            if (selected) {
              const t = selected.toTimeString().slice(0,5);
              setStartTime(t);
            }
          }}
        />
      )}

      {/* Hora de fin */}
      <Text style={styles.label}>Hora fin</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
        <Text>{endTime || 'Selecciona hora de fin'}</Text>
      </TouchableOpacity>
      {showEndPicker && (
        <DateTimePicker
          value={endTime ? new Date(`1970-01-01T${endTime}`) : new Date()}
          mode="time"
          display="default"
          onChange={(e, selected) => {
            setShowEndPicker(false);
            if (selected) {
              const t = selected.toTimeString().slice(0,5);
              setEndTime(t);
            }
          }}
        />
      )}

      {/* Archivos adjuntos */}
      <Text style={styles.label}>Archivos adjuntos</Text>
      <FileCarousel
        filesJson={attachedFiles}
        onChangeFilesJson={setAttachedFiles}
      />

      {/* Botones */}
      {canEdit && (
        <TouchableOpacity style={styles.btnSave} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Guardar cambios</Text>
          }
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.btnDelete} onPress={handleDelete} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Eliminar trabajo</Text>
          }
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );

  return (
       <FlatList
         data={[{}]}
         keyExtractor={() => 'form'}
         renderItem={renderForm}
         contentContainerStyle={styles.container}
         keyboardShouldPersistTaps="handled"
       // <-- Le decimos al FlatList que también re-renderice si cambia cualquiera de estos estados
         extraData={{
           selectedClient,
           selectedFolder,
           description,
           attachedFiles,
           jobDate,
           startTime,
           endTime,
         }}
       />
  );
}

const styles = StyleSheet.create({
  container:  { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label:      { marginTop: 12, fontSize: 16, fontWeight: '600' },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginVertical: 8 },
  input:      { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  btnSave:    { marginTop: 20, backgroundColor: '#007bff', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnDelete:  { marginTop: 10, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
