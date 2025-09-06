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
import FileGallery from '@/components/FileGallery';
import { JobsContext } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { ModalPicker, ModalPickerItem } from '@/components/ModalPicker';
import { StatusesContext } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { formatTimeInterval } from '@/utils/time';
import ParticipantsBubbles from '@/components/ParticipantsBubbles';
import { AuthContext } from '@/contexts/AuthContext';

export default function EditJobScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);

  const { jobs, updateJob, deleteJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { folders } = useContext(FoldersContext);
  const { statuses } = useContext(StatusesContext);
  const { tariffs } = useContext(TariffsContext);
  const { userId } = useContext(AuthContext);

  const job = jobs.find(j => j.id === jobId);
  const canEdit   = permissions.includes('updateJob');
  const canDelete = permissions.includes('deleteJob');

  // estados para pickers
  const [selectedClient,  setSelectedClient]  = useState<ModalPickerItem | null>(null);
  const [selectedFolder,  setSelectedFolder]  = useState<ModalPickerItem | null>(null);
  const [selectedStatus,  setSelectedStatus]  = useState<ModalPickerItem | null>(null);
  const [selectedTariff,  setSelectedTariff]  = useState<ModalPickerItem | null>(null);
  const manualTariffItem = useMemo<ModalPickerItem>(() => ({ id: '', name: '-- Tarifa manual --' }), []);
  const [manualAmount,   setManualAmount]    = useState('');

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
  const [participants, setParticipants] = useState<number[]>([]);
  const timeInterval = useMemo(() => formatTimeInterval(startTime, endTime), [startTime, endTime]);
  const rate = useMemo(() => (manualAmount ? parseFloat(manualAmount) : 0), [manualAmount]);
  const selectedTariffData = useMemo(
    () => tariffs.find(t => t.id === Number(selectedTariff?.id)),
    [tariffs, selectedTariff]
  );
  const filteredTariffs = useMemo(
    () => tariffs.filter(t => new Date(jobDate) >= new Date(t.last_update)),
    [tariffs, jobDate]
  );
  const price = useMemo(() => {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return diffHours > 0 && rate ? diffHours * rate : 0;
  }, [startTime, endTime, rate]);

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

    const statusObj = job.status_id != null ? statuses.find(s => s.id === job.status_id) : undefined;
    setSelectedStatus(
      statusObj
        ? { id: statusObj.id, name: statusObj.label, backgroundColor: statusObj.background_color }
        : null
    );

    const extractDate = (dt?: string) => (dt && dt.includes(' ') ? dt.split(' ')[0] : dt || '');
    const extractTime = (dt?: string) => (dt && dt.includes(' ') ? dt.split(' ')[1].slice(0,5) : dt || '');

    setDescription(job.description || '');
    const attachments = job.attached_files
      ? (typeof job.attached_files === 'string'
          ? JSON.parse(job.attached_files)
          : job.attached_files)
      : [];
    setAttachedFiles(attachments.length ? JSON.stringify(attachments) : '');
    setJobDate(extractDate(job.job_date));
    setStartTime(extractTime(job.start_time));
    setEndTime(extractTime(job.end_time));

    const tar = tariffs.find(t => t.id === job.tariff_id);
    setSelectedTariff(tar ? { id: tar.id, name: `${tar.name} - ${tar.amount}` } : manualTariffItem);
    setManualAmount(
      job.manual_amount ? job.manual_amount.toString() : tar ? tar.amount.toString() : ''
    );

    const parts = job.participants
      ? (typeof job.participants === 'string'
          ? JSON.parse(job.participants)
          : job.participants)
      : [];
    const ids = parts.map((p: any) => (typeof p === 'number' ? p : p.id));
    if (ids.length === 0 && userId) ids.push(Number(userId));
    setParticipants(ids);
  }, [job, clients, folders, statuses, tariffs, manualTariffItem]);

  useEffect(() => {
    if (selectedTariff && selectedTariff.id !== '') {
      const t = tariffs.find(t => t.id === Number(selectedTariff.id));
      if (t && new Date(jobDate) < new Date(t.last_update)) {
        setSelectedTariff(manualTariffItem);
        setManualAmount('');
      }
    }
  }, [jobDate, selectedTariff, tariffs, manualTariffItem]);

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

  const statusItems = useMemo(
    () => statuses.map(s => ({ id: s.id, name: s.label, backgroundColor: s.background_color })),
    [statuses]
  );

  const tariffItems = useMemo(
    () => [manualTariffItem, ...filteredTariffs.map(t => ({ id: t.id, name: `${t.name} - ${t.amount}` }))],
    [filteredTariffs, manualTariffItem]
  );

  const handleClientChange = (item: ModalPickerItem | null) => {
    setSelectedClient(item);
    setSelectedFolder(null);
    if (!item) {
      setSelectedTariff(manualTariffItem);
      setManualAmount('');
      return;
    }
    const client = clients.find(c => c.id === Number(item.id));
    if (client && client.tariff_id) {
      const t = tariffs.find(t => t.id === client.tariff_id);
      if (t && new Date(jobDate) >= new Date(t.last_update)) {
        setSelectedTariff({ id: t.id, name: `${t.name} - ${t.amount}` });
        setManualAmount(t.amount.toString());
        return;
      }
    }
    setSelectedTariff(manualTariffItem);
    setManualAmount('');
  };

  // submit
  const handleSubmit = async () => {
    if (!selectedClient || !description || !jobDate || !startTime || !endTime || !manualAmount) {
      Alert.alert('Error', 'Completa los campos obligatorios.');
      return;
    }
    const saveJob = async () => {
      setLoading(true);
      const updated = await updateJob(jobId, {
        client_id: Number(selectedClient.id),
        description,
        start_time: startTime,
        end_time: endTime,
        tariff_id: selectedTariff && selectedTariff.id !== '' ? Number(selectedTariff.id) : null,
        manual_amount: manualAmount ? Number(manualAmount) : null,
        attached_files: attachedFiles || null,
        folder_id: selectedFolder ? Number(selectedFolder.id) : null,
        job_date: jobDate,
        status_id: selectedStatus ? Number(selectedStatus.id) : null,
        participants,
      });
      setLoading(false);

      if (updated) {
        Alert.alert('Éxito', 'Trabajo actualizado.');
        router.back();
      } else {
        Alert.alert('Error', 'No se pudo actualizar el trabajo.');
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

      {/* Cliente */}
      <Text style={styles.label}>Cliente *</Text>
      <View style={styles.pickerWrap}>
        <ModalPicker
          items={clientItems}
          selectedItem={selectedClient}
          onSelect={handleClientChange}
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

      {/* Participantes */}
      <Text style={styles.label}>Participantes</Text>
      <ParticipantsBubbles
        participants={participants}
        onChange={setParticipants}
      />

      {/* Tarifa */}
      <Text style={styles.label}>Tarifa</Text>
      <View style={styles.pickerWrap}>
        <ModalPicker
          items={tariffItems}
          selectedItem={selectedTariff}
          onSelect={(item) => {
            setSelectedTariff(item);
            if (item && item.id !== '') {
              const t = tariffs.find(t => t.id === Number(item.id));
              if (t) setManualAmount(t.amount.toString());
            } else {
              setManualAmount('');
            }
          }}
          placeholder="-- Tarifa --"
        />
      </View>
      {selectedTariffData && (
        <Text style={styles.tariffInfo}>Última actualización: {selectedTariffData.last_update}</Text>
      )}

      {/* Tarifa manual */}
      {selectedTariff?.id === '' && (
        <>
          <Text style={styles.label}>Tarifa manual *</Text>
          <TextInput
            style={styles.input}
            value={manualAmount}
            onChangeText={setManualAmount}
            keyboardType="numeric"
            editable={canEdit}
          />
        </>
      )}

      {/* Descripción */}
      <Text style={styles.label}>Descripción *</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        multiline
        value={description}
        onChangeText={setDescription}
        editable={canEdit}
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
              const t = selected.toTimeString().slice(0,5);
              setStartTime(t);
              if (!endTime) setEndTime(t);
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
              if (!startTime) setStartTime(t);
            }
          }}
        />
      )}

      {startTime && endTime && (
        <Text style={styles.intervalText}>Intervalo: {timeInterval}</Text>
      )}

      {price > 0 && (
        <Text style={styles.priceText}>Costo estimado: ${price.toFixed(2)}</Text>
      )}

      {/* Archivos adjuntos */}
      <Text style={styles.label}>Archivos adjuntos</Text>
      <FileGallery
        filesJson={attachedFiles}
        onChangeFilesJson={setAttachedFiles}
        editable={canEdit}
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
         selectedStatus,
         selectedTariff,
          manualAmount,
          participants,
        }}
      />
  );
}

const styles = StyleSheet.create({
  container:  { padding: 16, backgroundColor: '#f7f7f7', flexGrow: 1 },
  label:      { marginTop: 16, marginBottom: 4, fontSize: 16, fontWeight: '600', color: '#333' },
  pickerWrap: { borderWidth: 1, borderColor: '#999', borderRadius: 8, marginBottom: 12, backgroundColor: '#fff' },
  input:      { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12, backgroundColor: '#fff', marginBottom: 12, color: '#000' },
  intervalText: { textAlign: 'center', marginBottom: 12, color: '#333' },
  priceText: { textAlign: 'center', marginBottom: 12, color: '#007BFF', fontWeight: 'bold', fontSize: 16 },
  tariffInfo: { marginBottom: 12, color: '#666' },
  btnSave:    { marginTop: 20, backgroundColor: '#007bff', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnDelete:  { marginTop: 10, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
