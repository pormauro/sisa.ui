// C:/Users/Mauri/Documents/GitHub/router/app/jobs/create.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  View,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import FileCarousel from '@/components/FileCarousel';
import { JobsContext } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { ModalPicker, ModalPickerItem } from '@/components/ModalPicker';
import { formatTimeInterval } from '@/utils/time';

export default function CreateJobScreen() {
  const router = useRouter();
  const { addJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { folders } = useContext(FoldersContext);
  const { statuses } = useContext(StatusesContext);
  // Form state
  const [selectedClient, setSelectedClient]   = useState<string>('');
  const [selectedFolder, setSelectedFolder]   = useState<string>('');
  const [selectedStatus, setSelectedStatus]   = useState<ModalPickerItem | null>(null);
  const [description, setDescription]         = useState<string>('');
  const [attachedFiles, setAttachedFiles]     = useState<string>('');
  const [jobDate, setJobDate]                 = useState<string>(() => new Date().toISOString().split('T')[0]);
  const defaultTime = useMemo(() => new Date().toTimeString().slice(0, 5), []);
  const [startTime, setStartTime]             = useState<string>(defaultTime);
  const [endTime, setEndTime]                 = useState<string>(defaultTime);
  const [startTimeTouched, setStartTimeTouched] = useState(false);
  const [endTimeTouched, setEndTimeTouched]     = useState(false);
  const [showDatePicker, setShowDatePicker]   = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);
  const [loading, setLoading]                 = useState<boolean>(false);
  const timeInterval = useMemo(() => formatTimeInterval(startTime, endTime), [startTime, endTime]);

  useEffect(() => {
    if (!permissions.includes('addJob')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar trabajos.');
      router.back();
    }
  }, [permissions]);

  const filteredFolders = useMemo(() => {
    if (!selectedClient) return [];
    const cid = parseInt(selectedClient, 10);
    return folders.filter(f => f.client_id === cid);
  }, [folders, selectedClient]);

  const statusItems = useMemo(
    () => statuses.map(s => ({ id: s.id, name: s.label, backgroundColor: s.background_color })),
    [statuses]
  );

  useEffect(() => {
    if (statuses.length > 0 && !selectedStatus) {
      const first = statuses[0];
      setSelectedStatus({ id: first.id, name: first.label, backgroundColor: first.background_color });
    }
  }, [statuses, selectedStatus]);


  const handleSubmit = async () => {
    if (!selectedClient || !description || !jobDate || !startTime || !endTime) {
      Alert.alert('Error', 'Completa todos los campos obligatorios.');
      return;
    }
    const saveJob = async () => {
      const jobData = {
        client_id: Number.parseInt(selectedClient, 10),
        description,
        start_time: startTime,
        end_time: endTime,
        tariff_id: null,
        manual_amount: null,
        attached_files: attachedFiles || null,
        folder_id: selectedFolder ? parseInt(selectedFolder, 10) : null,
        job_date: jobDate,
        status_id: selectedStatus ? Number(selectedStatus.id) : statuses[0]?.id,
      };
      setLoading(true);
      const created = await addJob(jobData);
      setLoading(false);
      if (created) {
        Alert.alert('Éxito', 'Trabajo creado.');
        router.back();
      } else {
        Alert.alert('Error', 'No se pudo crear el trabajo.');
      }
    };
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    if (end <= start) {
      Alert.alert(
        'Advertencia',
        'La hora de fin es anterior o igual a la hora de inicio. ¿Deseas guardar de todos modos?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Guardar', onPress: saveJob },
        ]
      );
      return;
    }
    await saveJob();
  };

  const renderForm = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      {/* Fecha del trabajo */}
      <Text style={styles.label}>Fecha</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text>{jobDate || 'Selecciona fecha'}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={new Date(jobDate)}
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

      {/* Cliente */}
      <Text style={styles.label}>Cliente *</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={selectedClient}
          onValueChange={setSelectedClient}
          style={styles.picker}
        >
          <Picker.Item label="-- Selecciona Cliente --" value="" />
          {clients.map(c => (
            <Picker.Item key={c.id} label={c.business_name} value={c.id.toString()} />
          ))}
        </Picker>
      </View>

      {/* Carpeta */}
      <Text style={styles.label}>Carpeta</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={selectedFolder}
          onValueChange={setSelectedFolder}
          enabled={!!selectedClient}
          style={styles.picker}
        >
          <Picker.Item label="-- Sin carpeta --" value="" />
          {filteredFolders.map(f => (
            <Picker.Item key={f.id} label={f.name} value={f.id.toString()} />
          ))}
        </Picker>
      </View>

      {/* Estado */}
      <Text style={styles.label}>Estado</Text>
      <View style={styles.pickerWrap}>
        <ModalPicker
          items={statusItems}
          selectedItem={selectedStatus}
          onSelect={setSelectedStatus}
          placeholder="-- Estado --"
        />
      </View>

      {/* Descripción */}
      <Text style={styles.label}>Descripción *</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Describe este trabajo"
        value={description}
        onChangeText={setDescription}
        multiline
      />

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
              setStartTimeTouched(true);
              const t = selected.toTimeString().slice(0,5);
              setStartTime(t);
              if (!endTimeTouched) setEndTime(t);
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
              setEndTimeTouched(true);
              const t = selected.toTimeString().slice(0,5);
              setEndTime(t);
              if (!startTimeTouched) setStartTime(t);
            }
          }}
        />
      )}

      {startTime && endTime && (
        <Text style={styles.intervalText}>Intervalo: {timeInterval}</Text>
      )}

      {/* Archivos adjuntos */}
      <Text style={styles.label}>Archivos adjuntos</Text>
      <FileCarousel filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} />

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Crear Trabajo</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );

  return (
    <FlatList
      data={[{}]}
      keyExtractor={() => 'form'}
      renderItem={renderForm}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f7f7f7' },
  label: { marginTop: 16, marginBottom: 4, fontSize: 16, fontWeight: '600', color: '#333' },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  picker: { height: 50, width: '100%' },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    color: '#000',
  },
  intervalText: { textAlign: 'center', marginBottom: 12, color: '#333' },
  submitBtn: {
    marginTop: 20,
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
