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
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import FileCarousel from '@/components/FileCarousel';
import { JobsContext } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { FoldersContext } from '@/contexts/FoldersContext';

export default function CreateJobScreen() {
  const router = useRouter();
  const { addJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { folders } = useContext(FoldersContext);
  // Form state
  const [selectedClient, setSelectedClient]   = useState<string>('');
  const [selectedFolder, setSelectedFolder]   = useState<string>('');
  const [description, setDescription]         = useState<string>('');
  const [attachedFiles, setAttachedFiles]     = useState<string>('');
  const [jobDate, setJobDate]                 = useState<string>('');
  const [startTime, setStartTime]             = useState<string>('');
  const [endTime, setEndTime]                 = useState<string>('');
  const [showDatePicker, setShowDatePicker]   = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);
  const [loading, setLoading]                 = useState<boolean>(false);

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


  const handleSubmit = async () => {
    if (!selectedClient || !description || !jobDate || !startTime || !endTime) {
      Alert.alert('Error', 'Completa todos los campos obligatorios.');
      return;
    }
    const startDateTime = `${jobDate} ${startTime}:00`;
    const endDateTime = `${jobDate} ${endTime}:00`;
    const jobData = {
      client_id: Number.parseInt(selectedClient, 10),
      description,
      start_time: startDateTime,
      end_time: endDateTime,
      tariff_id: null,
      manual_amount: null,
      attached_files: attachedFiles || null,
      folder_id: selectedFolder ? parseInt(selectedFolder, 10) : null,
      job_date: startDateTime,
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

  // Aquí renderizamos TODO el formulario como header de la FlatList
  const renderHeader = () => (
    <View>
      {/* Descripción */}
      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Describe este trabajo"
        value={description}
        onChangeText={setDescription}
        multiline
      />

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
      <FileCarousel filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} />
    </View>
  );

  // Como no tenemos datos de lista, pasamos un array vacío.
  return (
    <FlatList
      data={[]}
      keyExtractor={() => 'none'}
      renderItem={null}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={() => (
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>Crear Trabajo</Text>
          }
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  label: { marginTop: 12, fontSize: 16, fontWeight: '600' },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginVertical: 8,
  },
  picker: { height: 50, width: '100%' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    backgroundColor: '#fff',
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
