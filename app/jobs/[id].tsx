// C:/Users/Mauri/Documents/GitHub/router/app/jobs/[id].tsx
import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
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
import { ClientsContext } from '@/contexts/ClientsContext';
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
import { SearchableSelect } from '@/components/SearchableSelect';
import { usePendingSelection } from '@/contexts/PendingSelectionContext';
import { SELECTION_KEYS } from '@/constants/selectionKeys';

const parseManualAmountValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const normalized = trimmed.replace(/,/g, '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatManualAmountValue = (value: unknown): string => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
  }
  const parsed = parseManualAmountValue(value);
  return Number.isFinite(parsed) ? parsed.toString() : '';
};

export default function EditJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { id } = params;
  const jobId = Number(id);

  const { jobs, loadJobs, updateJob, deleteJob } = useContext(JobsContext);
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

  const job = jobs.find(j => j.id === jobId);
  const jobTariff = useMemo(() => {
    if (!job || job.tariff_id == null) {
      return null;
    }
    const match = tariffs.find(t => t.id === job.tariff_id);
    return match ?? null;
  }, [job, tariffs]);
  const jobTariffId = job?.tariff_id ?? null;
  const jobContextAmount = job?.manual_amount != null ? job.manual_amount : jobTariff?.amount;
  const canEdit   = permissions.includes('updateJob');
  const canDelete = permissions.includes('deleteJob');
  const NEW_CLIENT_VALUE  = '__new_client__';
  const NEW_STATUS_VALUE  = '__new_status__';
  const NEW_FOLDER_VALUE  = '__new_folder__';
  const NO_FOLDER_VALUE   = '__no_folder__';
  const NEW_TARIFF_VALUE  = '__new_tariff__';

  // estados para pickers
  const [selectedClientId, setSelectedClientId] = useState<string>('');
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
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isFetchingItem, setIsFetchingItem] = useState(false);
  const previousClientIdRef = useRef<string | null>(null);
  const isInitializingRef = useRef(true);
  const timeInterval = useMemo(() => formatTimeInterval(startTime, endTime), [startTime, endTime]);
  const trimmedManualAmount = manualAmount.trim();
  const parsedManualAmount = useMemo(
    () => parseManualAmountValue(trimmedManualAmount),
    [trimmedManualAmount]
  );
  const rate = useMemo(
    () => (trimmedManualAmount !== '' ? parsedManualAmount : 0),
    [trimmedManualAmount, parsedManualAmount]
  );
  const jobDateValue = useMemo(() => new Date(jobDate), [jobDate]);
  const isJobDateInvalid = Number.isNaN(jobDateValue.getTime());

  const clientItems = useMemo(
    () => [
      { label: '-- Cliente --', value: '' },
      { label: '➕ Nuevo cliente', value: NEW_CLIENT_VALUE },
      ...clients.map(client => ({
        label: client.business_name,
        value: client.id.toString(),
      })),
    ],
    [clients]
  );
  const price = useMemo(() => {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return diffHours > 0 && rate ? diffHours * rate : 0;
  }, [startTime, endTime, rate]);
  const manualTariffListLabel =
    trimmedManualAmount !== '' ? `Tarifa manual - ${trimmedManualAmount}` : manualTariffItem.name;
  const manualTariffDisplayLabel =
    trimmedManualAmount !== '' ? `Tarifa manual • Monto: ${trimmedManualAmount}` : manualTariffItem.name;

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#999', dark: '#555' }, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const priceColor = useThemeColor({}, 'tint');
  const btnSaveColor = useThemeColor({}, 'button');
  const btnTextColor = useThemeColor({}, 'buttonText');
  

  // carga inicial del job
  useEffect(() => {
    if (job) {
      isInitializingRef.current = true;
      if (hasAttemptedLoad) {
        setHasAttemptedLoad(false);
      }
      if (isFetchingItem) {
        setIsFetchingItem(false);
      }
      setSelectedClientId(job.client_id ? job.client_id.toString() : '');

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

      const manualValueFromContext = formatManualAmountValue(jobContextAmount);

      if (jobTariff) {
        setSelectedTariff({ id: jobTariff.id, name: `${jobTariff.name} - ${jobTariff.amount}` });
      } else if (job?.tariff_id != null) {
        setSelectedTariff({ id: job.tariff_id, name: `Tarifa #${job.tariff_id}` });
      } else {
        setSelectedTariff(manualTariffItem);
      }

      setManualAmount(manualValueFromContext);

      const parts = job.participants
        ? (typeof job.participants === 'string'
            ? JSON.parse(job.participants)
            : job.participants)
        : [];
      const ids = parts.map((p: any) => (typeof p === 'number' ? p : p.id));
      if (ids.length === 0 && userId) ids.push(Number(userId));
      setParticipants(ids);
      return;
    }

    isInitializingRef.current = true;
    if (hasAttemptedLoad) {
      return;
    }

    setHasAttemptedLoad(true);
    setIsFetchingItem(true);
    Promise.resolve(loadJobs()).finally(() => {
      setIsFetchingItem(false);
    });
  }, [job, jobTariff, clients, folders, statuses, tariffs, manualTariffItem, hasAttemptedLoad, isFetchingItem, loadJobs, userId]);

  useEffect(() => () => {
    cancelSelection();
  }, [cancelSelection]);

  useEffect(() => {
    const shouldSkipManualAmountReset = isInitializingRef.current;
    const shouldPreserveManualAmount = shouldSkipManualAmountReset && trimmedManualAmount !== '';

    if (isInitializingRef.current) {
      previousClientIdRef.current = selectedClientId;
      return;
    }

    if (previousClientIdRef.current === null) {
      previousClientIdRef.current = selectedClientId;
      return;
    }

    if (previousClientIdRef.current === selectedClientId) {
      return;
    }

    previousClientIdRef.current = selectedClientId;
    setSelectedFolder(null);

    if (!selectedClientId) {
      setSelectedTariff(manualTariffItem);
      if (!shouldSkipManualAmountReset) {
        setManualAmount('');
      }
      return;
    }

    const client = clients.find(c => c.id.toString() === selectedClientId);
    if (client?.tariff_id) {
      const t = tariffs.find(t => t.id === client.tariff_id);
      if (t) {
        setSelectedTariff({ id: t.id, name: `${t.name} - ${t.amount}` });
        if (!shouldPreserveManualAmount) {
          setManualAmount(formatManualAmountValue(t.amount));
        }
        return;
      }
    }

    setSelectedTariff(manualTariffItem);
    if (!shouldSkipManualAmountReset) {
      setManualAmount('');
    }
  }, [selectedClientId, clients, tariffs, manualTariffItem, trimmedManualAmount]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(pendingSelections, SELECTION_KEYS.jobs.client)) {
      return;
    }
    const pendingClientId = consumeSelection<string>(SELECTION_KEYS.jobs.client);
    if (pendingClientId) {
      setSelectedClientId(pendingClientId.toString());
    }
  }, [pendingSelections, consumeSelection]);

  useEffect(() => {
    const pendingValue = pendingSelections[SELECTION_KEYS.jobs.tariff];
    if (pendingValue === undefined || pendingValue === null) {
      return;
    }

    let pendingTariffId: string | null = null;
    let fallbackSelection: ModalPickerItem | null = null;
    let fallbackAmount: unknown;
    let hasFallbackAmount = false;

    if (typeof pendingValue === 'object') {
      const selection = pendingValue as Partial<ModalPickerItem> & { amount?: unknown };
      if (selection.id != null) {
        pendingTariffId = String(selection.id);
        const fallbackName =
          typeof selection.name === 'string' && selection.name.trim()
            ? selection.name
            : `Tarifa #${pendingTariffId}`;
        fallbackSelection = {
          id: selection.id,
          name: fallbackName,
          ...(selection.backgroundColor ? { backgroundColor: selection.backgroundColor } : {}),
        };
      }
      if (Object.prototype.hasOwnProperty.call(selection, 'amount')) {
        hasFallbackAmount = true;
        fallbackAmount = selection.amount;
      }
    } else if (typeof pendingValue === 'string' || typeof pendingValue === 'number') {
      const normalized = String(pendingValue).trim();
      if (normalized) {
        pendingTariffId = normalized;
      }
    }

    if (!pendingTariffId) {
      return;
    }

    const tariff = tariffs.find(t => t.id.toString() === pendingTariffId);
    if (tariff) {
      consumeSelection(SELECTION_KEYS.jobs.tariff);
      setSelectedTariff({ id: tariff.id, name: `${tariff.name} - ${tariff.amount}` });
      setManualAmount(formatManualAmountValue(tariff.amount));
      return;
    }

    if (fallbackSelection) {
      consumeSelection(SELECTION_KEYS.jobs.tariff);
      setSelectedTariff(fallbackSelection);
      if (hasFallbackAmount) {
        setManualAmount(formatManualAmountValue(fallbackAmount));
      }
    }
  }, [pendingSelections, consumeSelection, tariffs]);

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
    if (job && isInitializingRef.current) {
      isInitializingRef.current = false;
    }
  }, [job, selectedClientId, selectedTariff, jobDate, manualAmount]);

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
      setSelectedFolder(null);
      return;
    }
    const matchingFolder = folders.find(f => f.id.toString() === normalizedId);
    if (matchingFolder) {
      setSelectedFolder({ id: matchingFolder.id, name: matchingFolder.name });
      return;
    }
    setSelectedFolder({ id: normalizedId, name: `Carpeta #${normalizedId}` });
  }, [pendingSelections, consumeSelection, folders]);

  // opciones para pickers
  const folderItems = useMemo(
    () => {
      if (!selectedClientId) {
        return [
          { id: NO_FOLDER_VALUE, name: '-- Sin carpeta --' },
          { id: NEW_FOLDER_VALUE, name: '➕ Agregar carpeta' },
        ];
      }

      const clientFolders = folders
        .filter(f => f.client_id === Number(selectedClientId))
        .map(f => ({ id: f.id, name: f.name }));

      return [
        { id: NO_FOLDER_VALUE, name: '-- Sin carpeta --' },
        { id: NEW_FOLDER_VALUE, name: '➕ Agregar carpeta' },
        ...clientFolders,
      ];
    },
    [folders, selectedClientId]
  );

  const statusItems = useMemo(
    () => [
      { id: NEW_STATUS_VALUE, name: '➕ Nuevo estado' },
      ...statuses.map(s => ({ id: s.id, name: s.label, backgroundColor: s.background_color })),
    ],
    [statuses]
  );

  const tariffItems = useMemo(
    () => {
      const items: ModalPickerItem[] = [
        { id: NEW_TARIFF_VALUE, name: '➕ Nueva tarifa' },
        { ...manualTariffItem, name: manualTariffListLabel },
        ...tariffs.map(t => ({ id: t.id, name: `${t.name} - ${t.amount}` })),
      ];
      if (jobTariffId != null && !tariffs.some(t => t.id === jobTariffId)) {
        items.push({ id: jobTariffId, name: `Tarifa #${jobTariffId}` });
      }
      return items;
    },
    [manualTariffItem, tariffs, manualTariffListLabel, jobTariffId]
  );
  const selectedTariffForDisplay = useMemo(
    () => {
      if (!selectedTariff) {
        return null;
      }

      if (selectedTariff.id === manualTariffItem.id) {
        return { ...manualTariffItem, name: manualTariffDisplayLabel };
      }

      const selectedId = selectedTariff.id;
      const matchedTariff = selectedId != null
        ? tariffs.find(t => t.id.toString() === String(selectedId))
        : undefined;
      const baseName = matchedTariff?.name ?? selectedTariff.name ?? 'Tarifa';
      const idText = selectedId != null && selectedId !== '' ? `ID: ${selectedId}` : null;
      const amountText =
        trimmedManualAmount !== ''
          ? `Monto: ${trimmedManualAmount}`
          : matchedTariff?.amount != null
            ? `Monto: ${matchedTariff.amount}`
            : null;
      const labelParts = [baseName, idText, amountText].filter(Boolean);
      const displayName = labelParts.join(' • ') || baseName;
      return { ...selectedTariff, name: displayName };
    },
    [selectedTariff, manualTariffItem, manualTariffDisplayLabel, tariffs, trimmedManualAmount]
  );


  // submit
  const handleSubmit = async () => {
    if (
      !selectedClientId ||
      !description ||
      !jobDate ||
      !startTime ||
      !endTime ||
      trimmedManualAmount === ''
    ) {
      Alert.alert('Error', 'Completa los campos obligatorios.');
      return;
    }
    const saveJob = async () => {
      setLoading(true);
      const updated = await updateJob(jobId, {
        client_id: Number.parseInt(selectedClientId, 10),
        description,
        start_time: startTime,
        end_time: endTime,
        tariff_id: selectedTariff && selectedTariff.id !== '' ? Number(selectedTariff.id) : null,
        manual_amount:
          trimmedManualAmount !== '' ? parseManualAmountValue(trimmedManualAmount) : null,
        attached_files: attachedFiles || null,
        folder_id: selectedFolder ? Number(selectedFolder.id) : null,
        job_date: jobDate,
        status_id: selectedStatus ? Number(selectedStatus.id) : null,
        participants,
      });
      setLoading(false);

      if (updated) {
        Alert.alert('Éxito', 'Trabajo actualizado.');
        if (!Number.isNaN(jobId)) {
          completeSelection(jobId.toString());
        } else {
          cancelSelection();
        }
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
          value={isJobDateInvalid ? new Date() : jobDateValue}
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
        selectedValue={selectedClientId}
        onValueChange={(value) => {
          const stringValue = value?.toString() ?? '';
          if (stringValue === NEW_CLIENT_VALUE) {
            setSelectedClientId('');
            beginSelection(SELECTION_KEYS.jobs.client);
            router.push('/clients/create');
            return;
          }
          setSelectedClientId(stringValue);
        }}
        placeholder="-- Cliente --"
        disabled={!canEdit}
        onItemLongPress={(item) => {
          const value = String(item.value ?? '');
          if (!value || value === NEW_CLIENT_VALUE) return;
          beginSelection(SELECTION_KEYS.jobs.client);
          router.push(`/clients/${value}`);
        }}
      />

      {/* Carpeta */}
      <ThemedText style={[styles.label, { color: textColor }]}>Carpeta</ThemedText>
      <View style={styles.select}>
        <ModalPicker
          items={folderItems}
          selectedItem={selectedFolder}
          onSelect={(item) => {
            if (item.id === NEW_FOLDER_VALUE) {
              if (selectedClientId) {
                beginSelection(SELECTION_KEYS.jobs.folder);
                router.push({ pathname: '/folders/create', params: { client_id: selectedClientId } });
              }
              return;
            }

            if (item.id === NO_FOLDER_VALUE) {
              setSelectedFolder(null);
              return;
            }

            setSelectedFolder(item);
          }}
          placeholder="-- Carpeta --"
          disabled={!selectedClientId}
          onItemLongPress={(item) => {
            const value = String(item.id ?? '');
            if (!value || value === NEW_FOLDER_VALUE || value === NO_FOLDER_VALUE) return;
            beginSelection(SELECTION_KEYS.jobs.folder);
            router.push(`/folders/${value}`);
          }}
        />
      </View>

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
      <View style={styles.select}>
        <ModalPicker
          items={tariffItems}
          selectedItem={selectedTariffForDisplay}
          onSelect={(item) => {
            if (item.id === NEW_TARIFF_VALUE) {
              beginSelection(SELECTION_KEYS.jobs.tariff);
              router.push('/tariffs/create');
              return;
            }

            if (item.id === manualTariffItem.id) {
              setSelectedTariff(manualTariffItem);
              return;
            }

            setSelectedTariff(item);
            const t = tariffs.find(t => t.id === Number(item.id));
            if (t) {
              setManualAmount(formatManualAmountValue(t.amount));
            }
          }}
          placeholder="-- Tarifa --"
          onItemLongPress={(item) => {
            const value = String(item.id ?? '');
            if (!value || value === NEW_TARIFF_VALUE) return;
            beginSelection(SELECTION_KEYS.jobs.tariff);
            router.push(`/tariffs/${value}`);
          }}
        />
      </View>
      {/* Tarifa manual */}
      <ThemedText style={[styles.label, { color: textColor }]}>Tarifa manual *</ThemedText>
      <TextInput
        style={[styles.input, { backgroundColor: inputBackground, borderColor, color: inputTextColor }]}
        value={manualAmount}
        onChangeText={setManualAmount}
        keyboardType="numeric"
        editable={canEdit}
        placeholderTextColor={placeholderColor}
      />
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
        <ThemedText style={[styles.intervalText, { color: textColor }]}>Tiempo trabajado: {timeInterval}</ThemedText>
      )}

      {price > 0 && (
        <ThemedText style={[styles.priceText, { color: priceColor }]}>Costo: ${price.toFixed(2)}</ThemedText>
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

  if (!job) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}> 
        {isFetchingItem || !hasAttemptedLoad ? (
          <ActivityIndicator size="large" color={btnSaveColor} />
        ) : (
          <ThemedText style={styles.label}>Trabajo no encontrado</ThemedText>
        )}
      </ThemedView>
    );
  }

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
             selectedClientId,
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
             jobContextAmount,
             jobId: job?.id,
           }}
        />
       </ThemedView>
  );
}

const styles = StyleSheet.create({
  container:  { padding: 16, flexGrow: 1 },
  label:      { marginTop: 16, marginBottom: 4, fontSize: 16, fontWeight: '600' },
  select: { marginBottom: 12 },
  input:      { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  infoLabel: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  infoValue: { fontSize: 16, marginBottom: 8 },
  intervalText: { textAlign: 'center', marginBottom: 12 },
  priceText: { textAlign: 'center', marginBottom: 12, fontWeight: 'bold', fontSize: 16 },
  btnSave:    { marginTop: 20, padding: 16, borderRadius: 8, alignItems: 'center' },
  btnDelete:  { marginTop: 10, backgroundColor: '#dc3545', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnText:    { fontSize: 16, fontWeight: 'bold' },
});
