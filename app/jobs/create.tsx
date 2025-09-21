// C:/Users/Mauri/Documents/GitHub/router/app/jobs/create.tsx
import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import FileGallery from '@/components/FileGallery';
import { JobsContext } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { ModalPicker, ModalPickerItem } from '@/components/ModalPicker';
import { formatTimeInterval } from '@/utils/time';
import ParticipantsBubbles from '@/components/ParticipantsBubbles';
import { AuthContext } from '@/contexts/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SearchableSelect } from '@/components/SearchableSelect';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';

export default function CreateJobScreen() {
  const router = useRouter();
  const { client_id: clientIdParam } = useLocalSearchParams<{ client_id?: string | string[] }>();
  const { addJob } = useContext(JobsContext);
  const { permissions } = useContext(PermissionsContext);
  const { clients } = useContext(ClientsContext);
  const { folders } = useContext(FoldersContext);
  const { statuses } = useContext(StatusesContext);
  const { tariffs } = useContext(TariffsContext);
  const { userId } = useContext(AuthContext);
  const {
    beginSelection,
    consumeSelection,
    pendingSelections,
    completeSelection,
    cancelSelection,
  } = usePendingSelection();

  const NEW_CLIENT_VALUE = '__new_client__';
  const NEW_STATUS_VALUE = '__new_status__';
  const NEW_FOLDER_VALUE = '__new_folder__';
  const NEW_TARIFF_VALUE = '__new_tariff__';
  // Form state
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<ModalPickerItem | null>(null);
  const [selectedTariff, setSelectedTariff] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<string>('');
  const [jobDate, setJobDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const defaultTime = useMemo(() => new Date().toTimeString().slice(0, 5), []);
  const [startTime, setStartTime] = useState<string>(defaultTime);
  const [endTime, setEndTime] = useState<string>(defaultTime);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [participants, setParticipants] = useState<number[]>(() =>
    userId ? [Number(userId)] : []
  );
  const timeInterval = useMemo(() => formatTimeInterval(startTime, endTime), [startTime, endTime]);
  const trimmedManualAmount = manualAmount.trim();
  const rate = useMemo(
    () => (trimmedManualAmount !== '' ? parseFloat(trimmedManualAmount) : 0),
    [trimmedManualAmount]
  );
  const selectedTariffData = useMemo(
    () => tariffs.find(t => t.id.toString() === selectedTariff),
    [tariffs, selectedTariff]
  );
  const filteredTariffs = useMemo(
    () => tariffs.filter(t => new Date(jobDate) >= new Date(t.last_update)),
    [tariffs, jobDate]
  );

  const clientItems = useMemo(
    () => [
      { label: '-- Selecciona un cliente --', value: '' },
      { label: '➕ Nuevo cliente', value: NEW_CLIENT_VALUE },
      ...clients.map(client => ({
        label: client.business_name,
        value: client.id.toString(),
      })),
    ],
    [clients]
  );

  const filteredFolders = useMemo(() => {
    if (!selectedClient) return [];
    const cid = parseInt(selectedClient, 10);
    return folders.filter(f => f.client_id === cid);
  }, [folders, selectedClient]);

  const folderItems = useMemo(
    () => [
      { label: '-- Sin carpeta --', value: '' },
      { label: '➕ Agregar carpeta', value: NEW_FOLDER_VALUE },
      ...filteredFolders.map(folder => ({
        label: folder.name,
        value: folder.id.toString(),
      })),
    ],
    [filteredFolders]
  );

  const tariffItems = useMemo(
    () => [
      { label: '-- Tarifa manual --', value: '' },
      { label: '➕ Nueva tarifa', value: NEW_TARIFF_VALUE },
      ...filteredTariffs.map(tariff => ({
        label: `${tariff.name} - ${tariff.amount}`,
        value: tariff.id.toString(),
      })),
    ],
    [filteredTariffs]
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
  const submitBtnColor = useThemeColor({}, 'button');
  const submitTextColor = useThemeColor({}, 'buttonText');
  const tariffInfoColor = placeholderColor;

  const initialClientFromParams = useMemo(() => {
    if (!clientIdParam) return '';
    return Array.isArray(clientIdParam) ? clientIdParam[0] : clientIdParam;
  }, [clientIdParam]);

  useEffect(() => {
    if (!initialClientFromParams) return;
    setSelectedClient(prev => (prev ? prev : initialClientFromParams));
  }, [initialClientFromParams]);

  useEffect(() => {
    if (!permissions.includes('addJob')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para agregar trabajos.');
      router.back();
    }
  }, [permissions]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.jobs.client)) {
      return;
    }
    const pendingClientId = consumeSelection<string>(SELECTION_KEYS.jobs.client);
    if (pendingClientId) {
      setSelectedClient(pendingClientId.toString());
    }
  }, [pendingSelections, consumeSelection]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.jobs.tariff)) {
      return;
    }
    const pendingTariffId = consumeSelection<string>(SELECTION_KEYS.jobs.tariff);
    if (!pendingTariffId) {
      return;
    }
    const tariff = tariffs.find(t => t.id.toString() === pendingTariffId);
    if (!tariff) {
      return;
    }
    setSelectedTariff(pendingTariffId);
    setManualAmount(tariff.amount.toString());
  }, [pendingSelections, consumeSelection, tariffs]);

  useEffect(() => {
    if (!selectedClient) {
      setSelectedFolder('');
      setSelectedTariff('');
      setManualAmount('');
      return;
    }
    const client = clients.find(c => c.id.toString() === selectedClient);
    setSelectedFolder('');
    if (client?.tariff_id) {
      const clientTariff = tariffs.find(t => t.id === client.tariff_id);
      if (clientTariff && new Date(jobDate) >= new Date(clientTariff.last_update)) {
        setSelectedTariff(clientTariff.id.toString());
        setManualAmount(clientTariff.amount.toString());
        return;
      }
    }
    setSelectedTariff('');
    setManualAmount('');
  }, [selectedClient, clients, tariffs, jobDate]);

  const statusItems = useMemo(
    () => [
      { id: NEW_STATUS_VALUE, name: '➕ Nuevo estado' },
      ...statuses.map(s => ({ id: s.id, name: s.label, backgroundColor: s.background_color })),
    ],
    [statuses]
  );

  useEffect(() => {
    if (statuses.length > 0 && !selectedStatus) {
      const first = statuses[0];
      setSelectedStatus({ id: first.id, name: first.label, backgroundColor: first.background_color });
    }
  }, [statuses, selectedStatus]);

  useEffect(() => {
    if (
      !statuses.length ||
      !Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.jobs.status)
    ) {
      return;
    }
    const pendingStatusId = consumeSelection<number | string>(SELECTION_KEYS.jobs.status);
    if (pendingStatusId == null) {
      return;
    }
    const statusId = Number(pendingStatusId);
    if (Number.isNaN(statusId)) {
      return;
    }
    const status = statuses.find(s => s.id === statusId);
    if (!status) {
      return;
    }
    setSelectedStatus({
      id: status.id,
      name: status.label,
      backgroundColor: status.background_color,
    });
  }, [pendingSelections, consumeSelection, statuses]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.jobs.folder)) {
      return;
    }
    const pendingFolderId = consumeSelection<string | number>(SELECTION_KEYS.jobs.folder);
    if (pendingFolderId == null) {
      return;
    }
    const normalizedId = pendingFolderId.toString().trim();
    if (!normalizedId || normalizedId === 'null') {
      setSelectedFolder('');
      return;
    }
    setSelectedFolder(normalizedId);
  }, [pendingSelections, consumeSelection]);

  useEffect(() => {
    if (selectedTariff) {
      const t = tariffs.find(t => t.id.toString() === selectedTariff);
      if (t && new Date(jobDate) < new Date(t.last_update)) {
        setSelectedTariff('');
        setManualAmount('');
      }
    }
  }, [jobDate, selectedTariff, tariffs]);


  const handleSubmit = async () => {
    if (
      !selectedClient ||
      !description ||
      !jobDate ||
      !startTime ||
      !endTime ||
      trimmedManualAmount === ''
    ) {
      Alert.alert('Error', 'Completa todos los campos obligatorios.');
      return;
    }
    const saveJob = async () => {
      const jobData = {
        client_id: Number.parseInt(selectedClient, 10),
        description,
        start_time: startTime,
        end_time: endTime,
        tariff_id: selectedTariff ? parseInt(selectedTariff, 10) : null,
        manual_amount: trimmedManualAmount !== '' ? parseFloat(trimmedManualAmount) : null,
        attached_files: attachedFiles || null,
        folder_id: selectedFolder ? parseInt(selectedFolder, 10) : null,
        job_date: jobDate,
        status_id: selectedStatus ? Number(selectedStatus.id) : null,
        participants,
      };
      setLoading(true);
      const created = await addJob(jobData);
      setLoading(false);
      if (created) {
        Alert.alert('Éxito', 'Trabajo creado.');
        if (created.id != null) {
          completeSelection(created.id.toString());
        } else {
          cancelSelection();
        }
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
      <ThemedText style={[styles.label, { color: textColor }]}>Cliente *</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={clientItems}
        selectedValue={selectedClient}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CLIENT_VALUE) {
            setSelectedClient('');
            beginSelection(SELECTION_KEYS.jobs.client);
            router.push('/clients/create');
            return;
          }
          setSelectedClient(stringValue);
        }}
        placeholder="-- Selecciona un cliente --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CLIENT_VALUE) return;
          beginSelection(SELECTION_KEYS.jobs.client);
          router.push(`/clients/${value}`);
        }}
      />

      {/* Carpeta */}
      <ThemedText style={[styles.label, { color: textColor }]}>Carpeta</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={folderItems}
        selectedValue={selectedFolder}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_FOLDER_VALUE) {
            setSelectedFolder('');
            if (selectedClient) {
              beginSelection(SELECTION_KEYS.jobs.folder);
              router.push({ pathname: '/folders/create', params: { client_id: selectedClient } });
            }
            return;
          }
          setSelectedFolder(stringValue);
        }}
        placeholder="-- Sin carpeta --"
        disabled={!selectedClient}
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_FOLDER_VALUE) return;
          beginSelection(SELECTION_KEYS.jobs.folder);
          router.push(`/folders/${value}`);
        }}
      />

      {/* Estado */}
      <ThemedText style={[styles.label, { color: textColor }]}>Estado</ThemedText>
      <View style={styles.select}>
        <ModalPicker
          items={statusItems}
          selectedItem={selectedStatus}
          onSelect={(item) => {
            if (item.id === NEW_STATUS_VALUE) {
              beginSelection(SELECTION_KEYS.jobs.status);
              router.push('/statuses/create');
              return;
            }
            setSelectedStatus(item);
          }}
          placeholder="-- Estado --"
          onItemLongPress={(item) => {
            const value = String(item.id ?? '');
            if (!value || value === NEW_STATUS_VALUE) return;
            beginSelection(SELECTION_KEYS.jobs.status);
            router.push(`/statuses/${value}`);
          }}
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
      <SearchableSelect
        style={styles.select}
        items={tariffItems}
        selectedValue={selectedTariff}
        onValueChange={(val) => {
          const stringValue = val?.toString() ?? '';
          if (stringValue === NEW_TARIFF_VALUE) {
            setSelectedTariff('');
            setManualAmount('');
            beginSelection(SELECTION_KEYS.jobs.tariff);
            router.push('/tariffs/create');
            return;
          }
          setSelectedTariff(stringValue);
          const t = tariffs.find(tariff => tariff.id.toString() === stringValue);
          if (t) {
            setManualAmount(t.amount.toString());
          } else {
            setManualAmount('');
          }
        }}
        placeholder="-- Tarifa manual --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_TARIFF_VALUE) return;
          beginSelection(SELECTION_KEYS.jobs.tariff);
          router.push(`/tariffs/${value}`);
        }}
      />
      {selectedTariffData && (
        <ThemedText style={[styles.tariffInfo, { color: tariffInfoColor }]}>Última actualización: {selectedTariffData.last_update}</ThemedText>
      )}

      {/* Tarifa manual */}
      {selectedTariff === '' && (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Tarifa manual *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
            placeholder="Ingresa tarifa manual"
            placeholderTextColor={placeholderColor}
            value={manualAmount}
            onChangeText={setManualAmount}
            keyboardType="numeric"
          />
        </>
      )}

      {/* Descripción */}
      <ThemedText style={[styles.label, { color: textColor }]}>Descripción *</ThemedText>
      <TextInput
        style={[styles.input, { height: 80, backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
        placeholder="Describe este trabajo"
        placeholderTextColor={placeholderColor}
        value={description}
        onChangeText={setDescription}
        multiline
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
        <ThemedText style={[styles.intervalText, { color: textColor }]}>Tiempo trabajado: {timeInterval}</ThemedText>
      )}

      {price > 0 && (
        <ThemedText style={[styles.priceText, { color: priceColor }]}>Costo estimado: ${price.toFixed(2)}</ThemedText>
      )}

      {/* Archivos adjuntos */}
      <ThemedText style={[styles.label, { color: textColor }]}>Archivos adjuntos</ThemedText>
      <FileGallery filesJson={attachedFiles} onChangeFilesJson={setAttachedFiles} editable />

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: submitBtnColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={submitTextColor} />
        ) : (
          <ThemedText style={[styles.submitText, { color: submitTextColor }]}>Crear Trabajo</ThemedText>
        )}
      </TouchableOpacity>
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
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { marginTop: 16, marginBottom: 4, fontSize: 16, fontWeight: '600' },
  select: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  intervalText: { textAlign: 'center', marginBottom: 12 },
  priceText: { textAlign: 'center', marginBottom: 12, fontWeight: 'bold', fontSize: 16 },
  tariffInfo: { marginBottom: 12 },
  submitBtn: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: 'bold' },
});
