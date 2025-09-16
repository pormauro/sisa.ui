// C:/Users/Mauri/Documents/GitHub/router/app/jobs/[id].tsx
import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import {
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
import { ClientsContext, Client } from '@/contexts/ClientsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { ModalPicker, ModalPickerItem } from '@/components/ModalPicker';
import { StatusesContext } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { formatTimeInterval } from '@/utils/time';
import ParticipantsBubbles from '@/components/ParticipantsBubbles';
import { AuthContext } from '@/contexts/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
  buildSelectionPath,
  CLEAR_SELECTION_VALUE,
  getSingleParamValue,
} from '@/utils/selection';

export default function EditJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; selectedClientId?: string }>();
  const { id } = params;
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
  const [selectedClient,  setSelectedClientState]  = useState<Client | null>(null);
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
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
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

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#999', dark: '#555' }, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const priceColor = useThemeColor({}, 'tint');
  const btnSaveColor = useThemeColor({}, 'button');
  const btnTextColor = useThemeColor({}, 'buttonText');
  const tariffInfoColor = placeholderColor;

  // carga inicial del job
  useEffect(() => {
    if (!job) {
      Alert.alert('Error', 'Trabajo no encontrado.');
      router.back();
      return;
    }
    // cargar pickers
    const cli = clients.find(c => c.id === job.client_id) ?? null;
    setSelectedClientState(cli);

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

  const applyClientSelection = useCallback(
    (client: Client | null) => {
      setSelectedClientState(client);
      setSelectedFolder(null);
      if (!client) {
        setSelectedTariff(manualTariffItem);
        setManualAmount('');
        return;
      }
      if (client.tariff_id) {
        const t = tariffs.find(t => t.id === client.tariff_id);
        if (t && new Date(jobDate) >= new Date(t.last_update)) {
          setSelectedTariff({ id: t.id, name: `${t.name} - ${t.amount}` });
          setManualAmount(t.amount.toString());
          return;
        }
      }
      setSelectedTariff(manualTariffItem);
      setManualAmount('');
    },
    [jobDate, manualTariffItem, tariffs]
  );

  const selectedClientParam = getSingleParamValue(params.selectedClientId);

  useEffect(() => {
    if (selectedClientParam === undefined) return;
    if (selectedClientParam === CLEAR_SELECTION_VALUE) {
      applyClientSelection(null);
      router.replace({ pathname: `/jobs/${jobId}` });
      return;
    }
    setPendingClientId(selectedClientParam);
    router.replace({ pathname: `/jobs/${jobId}` });
  }, [selectedClientParam, applyClientSelection, jobId, router]);

  useEffect(() => {
    if (!pendingClientId) return;
    if (clients.length === 0) return;
    const found = clients.find(c => c.id.toString() === pendingClientId);
    if (found) {
      applyClientSelection(found);
    } else {
      applyClientSelection(null);
    }
    setPendingClientId(null);
  }, [pendingClientId, clients, applyClientSelection]);


  // submit
  const handleSubmit = async () => {
    if (!selectedClient || !description || !jobDate || !startTime || !endTime || !manualAmount) {
      Alert.alert('Error', 'Completa los campos obligatorios.');
      return;
    }
    const saveJob = async () => {
      setLoading(true);
      const updated = await updateJob(jobId, {
        client_id: selectedClient.id,
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
      <ThemedText style={[styles.label, { color: textColor }]}>Fecha</ThemedText>
      <TouchableOpacity
        style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
        onPress={() => setShowDatePicker(true)}
      >
        <ThemedText style={{ color: jobDate ? inputTextColor : placeholderColor }}>
          {jobDate || 'Selecciona fecha'}
        </ThemedText>
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
      <ThemedText style={[styles.label, { color: textColor }]}>Cliente *</ThemedText>
      <TouchableOpacity
        style={[
          styles.pickerWrap,
          { borderColor, backgroundColor: inputBackground },
          !canEdit ? { opacity: 0.6 } : {},
        ]}
        onPress={() => {
          if (!canEdit) return;
          const path = buildSelectionPath('/clients', {
            selectedId: selectedClient ? selectedClient.id : undefined,
            returnTo: `/jobs/${jobId}`,
            returnParam: 'selectedClientId',
          });
          router.push(path);
        }}
        disabled={!canEdit}
      >
        <ThemedText style={{ color: selectedClient ? inputTextColor : placeholderColor }}>
          {selectedClient ? selectedClient.business_name : '-- Cliente --'}
        </ThemedText>
      </TouchableOpacity>

      {/* Carpeta */}
      <ThemedText style={[styles.label, { color: textColor }]}>Carpeta</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: inputBackground }]}>
        <ModalPicker
          items={folderItems}
          selectedItem={selectedFolder}
          onSelect={setSelectedFolder}
          placeholder="-- Carpeta --"
        />
      </View>

      {/* Estado */}
      <ThemedText style={[styles.label, { color: textColor }]}>Estado</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: inputBackground }]}>
        <ModalPicker
          items={statusItems}
          selectedItem={selectedStatus}
          onSelect={setSelectedStatus}
          placeholder="-- Estado --"
        />
      </View>

      {/* Participantes */}
      <ThemedText style={[styles.label, { color: textColor }]}>Participantes</ThemedText>
      <ParticipantsBubbles
        participants={participants}
        onChange={setParticipants}
      />

      {/* Tarifa */}
      <ThemedText style={[styles.label, { color: textColor }]}>Tarifa</ThemedText>
      <View style={[styles.pickerWrap, { borderColor, backgroundColor: inputBackground }]}>
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
        <ThemedText style={[styles.tariffInfo, { color: tariffInfoColor }]}>Última actualización: {selectedTariffData.last_update}</ThemedText>
      )}

      {/* Tarifa manual */}
      {selectedTariff?.id === '' && (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Tarifa manual *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
            value={manualAmount}
            onChangeText={setManualAmount}
            keyboardType="numeric"
            editable={canEdit}
            placeholderTextColor={placeholderColor}
          />
        </>
      )}

      {/* Descripción */}
      <ThemedText style={[styles.label, { color: textColor }]}>Descripción *</ThemedText>
      <TextInput
        style={[styles.input, { height: 80, backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
        multiline
        value={description}
        onChangeText={setDescription}
        editable={canEdit}
        placeholderTextColor={placeholderColor}
      />

      {/* Hora de inicio */}
      <ThemedText style={[styles.label, { color: textColor }]}>Hora inicio</ThemedText>
      <TouchableOpacity
        style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
        onPress={() => setShowStartPicker(true)}
      >
        <ThemedText style={{ color: startTime ? inputTextColor : placeholderColor }}>
          {startTime || 'Selecciona hora de inicio'}
        </ThemedText>
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
      <ThemedText style={[styles.label, { color: textColor }]}>Hora fin</ThemedText>
      <TouchableOpacity
        style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
        onPress={() => setShowEndPicker(true)}
      >
        <ThemedText style={{ color: endTime ? inputTextColor : placeholderColor }}>
          {endTime || 'Selecciona hora de fin'}
        </ThemedText>
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

      {startTime && endTime && (
        <ThemedText style={[styles.intervalText, { color: textColor }]}>Intervalo: {timeInterval}</ThemedText>
      )}

      {price > 0 && (
        <ThemedText style={[styles.priceText, { color: priceColor }]}>Costo estimado: ${price.toFixed(2)}</ThemedText>
      )}

      {/* Archivos adjuntos */}
      <ThemedText style={[styles.label, { color: textColor }]}>Archivos adjuntos</ThemedText>
      <FileGallery
        filesJson={attachedFiles}
        onChangeFilesJson={setAttachedFiles}
        editable={canEdit}
      />

      {/* Botones */}
      {canEdit && (
        <TouchableOpacity style={[styles.btnSave, { backgroundColor: btnSaveColor }]} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color={btnTextColor} />
            : <ThemedText style={[styles.btnText, { color: btnTextColor }]}>Guardar cambios</ThemedText>
          }
        </TouchableOpacity>
      )}
      {canDelete && (
        <TouchableOpacity style={styles.btnDelete} onPress={handleDelete} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <ThemedText style={[styles.btnText, { color: '#fff' }]}>Eliminar trabajo</ThemedText>
          }
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );

  return (
       <ThemedView style={{ flex: 1 }}>
         <FlatList
           data={[{}]}
           keyExtractor={() => 'form'}
           renderItem={renderForm}
           contentContainerStyle={[styles.container, { backgroundColor: background }]}
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
       </ThemedView>
  );
}

const styles = StyleSheet.create({
  container:  { padding: 16, flexGrow: 1 },
  label:      { marginTop: 16, marginBottom: 4, fontSize: 16, fontWeight: '600' },
  pickerWrap: { borderWidth: 1, borderRadius: 8, marginBottom: 12 },
  input:      { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  intervalText: { textAlign: 'center', marginBottom: 12 },
  priceText: { textAlign: 'center', marginBottom: 12, fontWeight: 'bold', fontSize: 16 },
  tariffInfo: { marginBottom: 12 },
  btnSave:    { marginTop: 20, padding: 16, borderRadius: 8, alignItems: 'center' },
  btnDelete:  { marginTop: 10, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnText:    { fontSize: 16, fontWeight: 'bold' },
});
