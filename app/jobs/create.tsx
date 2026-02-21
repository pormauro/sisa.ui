// C:/Users/Mauri/Documents/GitHub/router/app/jobs/create.tsx
import React, { useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { FileGallery } from '@/components/FileGallery';
import { JobsContext } from '@/contexts/JobsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { StatusesContext } from '@/contexts/StatusesContext';
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
import { TariffsContext } from '@/contexts/TariffsContext';
import { formatCurrency } from '@/utils/currency';
import { useCachedState } from '@/hooks/useCachedState';

const NEW_TARIFF_VALUE = '__new_tariff__';

const parseManualAmountInput = (value: string): number | null | undefined => {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[^0-9,.-]/g, '');
  if (!cleaned) {
    return undefined;
  }

  let normalized = cleaned;
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';

    normalized = cleaned.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '');

    if (decimalSeparator !== '.') {
      normalized = normalized.replace(new RegExp(`\\${decimalSeparator}`, 'g'), '.');
    }
  } else if (hasComma) {
    normalized = cleaned.replace(/,/g, '.');
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
};

export default function CreateJobScreen() {
  const router = useRouter();
  const { client_id: clientIdParam, job_date } = useLocalSearchParams<{
    client_id?: string | string[];
    job_date?: string | string[];
  }>();
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
  const initialClientFromParam = useMemo(() => {
    if (!clientIdParam) {
      return '';
    }
    return Array.isArray(clientIdParam) ? clientIdParam[0] ?? '' : clientIdParam;
  }, [clientIdParam]);
  const initialJobDateFromParam = useMemo(() => {
    if (!job_date) {
      return '';
    }
    return Array.isArray(job_date) ? job_date[0] ?? '' : job_date;
  }, [job_date]);
  // Form state
  const [selectedClient, setSelectedClient] = useState<string>(initialClientFromParam);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<ModalPickerItem | null>(null);
  const [selectedTariff, setSelectedTariff] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualAmountTouched, setManualAmountTouched] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<string>('');
  const [jobDate, setJobDate] = useState<string>(() =>
    initialJobDateFromParam || new Date().toISOString().split('T')[0]
  );
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
  const [draftReady, setDraftReady] = useState(false);
  const [draft, setDraft, draftHydrated] = useCachedState<{
    selectedClient: string;
    selectedFolder: string;
    selectedStatusId: number | null;
    selectedTariff: string;
    manualAmount: string;
    manualAmountTouched: boolean;
    description: string;
    attachedFiles: string;
    jobDate: string;
    startTime: string;
    endTime: string;
    participants: number[];
  } | null>('drafts.jobs.create', null);
  const draftAppliedRef = useRef(false);
  const timeInterval = useMemo(() => formatTimeInterval(startTime, endTime), [startTime, endTime]);
  const jobDateValue = useMemo(() => new Date(jobDate), [jobDate]);
  const isJobDateInvalid = Number.isNaN(jobDateValue.getTime());

  useEffect(() => {
    if (!selectedClient && initialClientFromParam) {
      setSelectedClient(initialClientFromParam);
    }
  }, [initialClientFromParam, selectedClient]);

  useEffect(() => {
    if (initialJobDateFromParam) {
      setJobDate(initialJobDateFromParam);
    }
  }, [initialJobDateFromParam]);

  useEffect(() => {
    const hasNavigationParams =
      !!initialClientFromParam || !!initialJobDateFromParam;

    if (!hasNavigationParams) {
      setDraft(null);
    }
  }, [initialClientFromParam, initialJobDateFromParam, setDraft]);

  useEffect(() => {
    if (!draft || selectedStatus || !draft.selectedStatusId) {
      return;
    }
    const restoredStatus = statuses.find(status => status.id === draft.selectedStatusId) ?? null;
    if (restoredStatus) {
      setSelectedStatus(restoredStatus);
    }
  }, [draft, selectedStatus, statuses]);

  useEffect(() => {
    if (!draftHydrated || draftAppliedRef.current) {
      return;
    }
    draftAppliedRef.current = true;
    if (draft) {
      setSelectedClient(draft.selectedClient);
      setSelectedFolder(draft.selectedFolder);
      setSelectedTariff(draft.selectedTariff);
      setManualAmount(draft.manualAmount);
      setManualAmountTouched(draft.manualAmountTouched);
      setDescription(draft.description);
      setAttachedFiles(draft.attachedFiles);
      setJobDate(draft.jobDate);
      setStartTime(draft.startTime);
      setEndTime(draft.endTime);
      setParticipants(draft.participants);
      if (draft.selectedStatusId) {
        const restoredStatus = statuses.find(status => status.id === draft.selectedStatusId) ?? null;
        setSelectedStatus(restoredStatus);
      } else {
        setSelectedStatus(null);
      }
    }
    setDraftReady(true);
  }, [draft, draftHydrated, statuses]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }
    setDraft({
      selectedClient,
      selectedFolder,
      selectedStatusId: selectedStatus?.id ?? null,
      selectedTariff,
      manualAmount,
      manualAmountTouched,
      description,
      attachedFiles,
      jobDate,
      startTime,
      endTime,
      participants,
    });
  }, [
    attachedFiles,
    description,
    draftReady,
    endTime,
    jobDate,
    manualAmount,
    manualAmountTouched,
    participants,
    selectedClient,
    selectedFolder,
    selectedStatus,
    selectedTariff,
    setDraft,
    startTime,
  ]);

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
      { label: '-- Sin tarifa --', value: '' },
      { label: '➕ Nueva tarifa', value: NEW_TARIFF_VALUE },
      ...tariffs.map(tariff => ({
        label: `${tariff.name} — ${formatCurrency(tariff.amount)}`,
        value: tariff.id.toString(),
      })),
    ],
    [tariffs]
  );

  const applyTariffSelection = useCallback(
    (value: string) => {
      setSelectedTariff(value);
      if (!value) {
        setManualAmountTouched(true);
        return;
      }
      const tariff = tariffs.find(t => t.id.toString() === value);
      if (tariff) {
        setManualAmount(tariff.amount.toString());
        setManualAmountTouched(false);
      }
    },
    [tariffs]
  );

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#999', dark: '#555' }, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const submitBtnColor = useThemeColor({}, 'button');
  const submitTextColor = useThemeColor({}, 'buttonText');

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
    setSelectedFolder('');
  }, [selectedClient]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.jobs.tariff)) {
      return;
    }
    const pendingTariffId = consumeSelection<string | number>(SELECTION_KEYS.jobs.tariff);
    if (pendingTariffId == null) {
      applyTariffSelection('');
      return;
    }
    const normalizedId = pendingTariffId.toString().trim();
    if (!normalizedId || normalizedId === 'null') {
      applyTariffSelection('');
      return;
    }
    applyTariffSelection(normalizedId);
  }, [pendingSelections, consumeSelection, applyTariffSelection]);

  useEffect(() => {
    if (!selectedTariff || manualAmountTouched) {
      return;
    }
    const tariff = tariffs.find(t => t.id.toString() === selectedTariff);
    if (tariff) {
      setManualAmount(tariff.amount.toString());
    }
  }, [selectedTariff, manualAmountTouched, tariffs]);

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

  const handleSubmit = async () => {
    if (!selectedClient || !description || !jobDate || !startTime || !endTime) {
      Alert.alert('Error', 'Completa todos los campos obligatorios.');
      return;
    }

    const manualAmountValue = parseManualAmountInput(manualAmount);
    if (typeof manualAmountValue === 'undefined') {
      Alert.alert('Monto inválido', 'Ingresa un monto manual válido.');
      return;
    }

    const parsedTariffId = selectedTariff ? Number.parseInt(selectedTariff, 10) : null;
    const tariffIdValue =
      parsedTariffId !== null && !Number.isNaN(parsedTariffId) ? parsedTariffId : null;

    const saveJob = async () => {
      const jobData = {
        client_id: Number.parseInt(selectedClient, 10),
        description,
        start_time: startTime,
        end_time: endTime,
        tariff_id: tariffIdValue,
        manual_amount: manualAmountValue,
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
        setDraft(null);
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
          value={
            isJobDateInvalid
              ? new Date()
              : (() => {
                  const [year, month, day] = jobDate.split('-').map(Number);
                  return new Date(year, month - 1, day);
                })()
          }
          mode="date"
          display="default"
          onChange={(e, selected) => {
            setShowDatePicker(false);
            if (selected) {
              const year = selected.getFullYear();
              const month = String(selected.getMonth() + 1).padStart(2, '0');
              const day = String(selected.getDate()).padStart(2, '0');
              const d = `${year}-${month}-${day}`;
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

      {/* Tarifa */}
      <ThemedText style={[styles.label, { color: textColor }]}>Tarifa</ThemedText>
      <SearchableSelect
        style={styles.select}
        items={tariffItems}
        selectedValue={selectedTariff}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_TARIFF_VALUE) {
            applyTariffSelection('');
            beginSelection(SELECTION_KEYS.jobs.tariff);
            router.push('/tariffs/create');
            return;
          }
          applyTariffSelection(stringValue);
        }}
        placeholder="-- Sin tarifa --"
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_TARIFF_VALUE) return;
          beginSelection(SELECTION_KEYS.jobs.tariff);
          router.push(`/tariffs/${value}`);
        }}
      />
      <ThemedText style={[styles.helperText, { color: placeholderColor }]}>El monto manual se inicia con el valor actual de la tarifa seleccionada.</ThemedText>

      {/* Monto manual */}
      <ThemedText style={[styles.label, { color: textColor }]}>Monto manual</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
        placeholder="Ingresa un monto"
        placeholderTextColor={placeholderColor}
        keyboardType="decimal-pad"
        value={manualAmount}
        onChangeText={(text) => {
          setManualAmount(text);
          setManualAmountTouched(true);
        }}
      />

      {/* Participantes */}
      <ThemedText style={[styles.label, { color: textColor }]}>Participantes</ThemedText>
      <ParticipantsBubbles
        participants={participants}
        onChange={setParticipants}
      />

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

      {/* Archivos adjuntos */}
      <ThemedText style={[styles.label, { color: textColor }]}>Archivos adjuntos</ThemedText>
      <FileGallery entityType="job" entityId={0} filesJson={attachedFiles} />

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
  helperText: {
    marginTop: -4,
    marginBottom: 8,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  intervalText: { textAlign: 'center', marginBottom: 12 },
  submitBtn: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: 'bold' },
});
