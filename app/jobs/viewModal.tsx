import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { JobsContext } from '@/contexts/JobsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { ProfilesContext } from '@/contexts/ProfilesContext';
import FileGallery from '@/components/FileGallery';
import { formatTimeInterval } from '@/utils/time';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

const getContrastingTextColor = (color: string): string => {
  if (!color) return '#fff';

  let normalized = color.trim();
  if (normalized.startsWith('#')) {
    normalized = normalized.slice(1);
  }

  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map(char => char + char)
      .join('');
  }

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000' : '#fff';
  }

  const rgbMatch = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const [, rStr, gStr, bStr] = rgbMatch;
    const r = Number(rStr);
    const g = Number(gStr);
    const b = Number(bStr);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000' : '#fff';
  }

  return '#fff';
};

export default function ViewJobModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const { jobs } = useContext(JobsContext);
  const { clients } = useContext(ClientsContext);
  const { statuses } = useContext(StatusesContext);
  const { tariffs } = useContext(TariffsContext);
  const { folders } = useContext(FoldersContext);
  const { getProfile } = useContext(ProfilesContext);

  const job = jobs.find(j => j.id === jobId);
  const client = clients.find(c => c.id === job?.client_id);
  const status = statuses.find(s => s.id === job?.status_id);
  const tariff = tariffs.find(t => t.id === job?.tariff_id);
  const folder = folders.find(f => f.id === job?.folder_id);

  const participantIds = useMemo(() => {
    const parts = job?.participants
      ? typeof job.participants === 'string'
        ? JSON.parse(job.participants)
        : job.participants
      : [];
    return parts.map((p: any) => (typeof p === 'number' ? p : p.id));
  }, [job?.participants]);

  const [participantNames, setParticipantNames] = useState<string[]>([]);
  useEffect(() => {
    const load = async () => {
      const names: string[] = [];
      for (const pid of participantIds) {
        const profile = await getProfile(pid);
        if (profile) names.push(profile.full_name);
      }
      setParticipantNames(names);
    };
    void load();
  }, [participantIds, getProfile]);

  const startStr = job?.start_time?.slice(0, 5) || '';
  const endStr = job?.end_time?.slice(0, 5) || '';
  const interval = formatTimeInterval(startStr, endStr);
  const rate = tariff ? tariff.amount : job?.manual_amount ?? 0;
  let finalCost = 0;
  if (startStr && endStr && rate) {
    const startDate = new Date(`1970-01-01T${startStr}`);
    const endDate = new Date(`1970-01-01T${endStr}`);
    const diffHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    finalCost = diffHours > 0 ? diffHours * rate : 0;
  }

  const filesJson = job?.attached_files
    ? typeof job.attached_files === 'string'
      ? job.attached_files
      : JSON.stringify(job.attached_files)
    : '';

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const statusBackgroundColor = status?.background_color ?? '#1f2937';
  const statusTextColor = getContrastingTextColor(statusBackgroundColor);
  const headerTitle = status?.label ? `Trabajo ${status.label}` : 'Trabajo';
  const headerTintColor = status?.background_color ? statusTextColor : textColor;

  useEffect(() => {
    const options: Partial<NativeStackNavigationOptions> = {
      title: headerTitle,
      headerStyle: { backgroundColor: status?.background_color ?? background },
      headerTintColor,
      headerTitleStyle: { color: headerTintColor },
    };

    navigation.setOptions(options);
  }, [navigation, headerTitle, status?.background_color, background, headerTintColor]);

  if (!job) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}> 
        <ThemedText style={{ color: textColor }}>Trabajo no encontrado</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}>
      <ThemedText style={[styles.label, { color: textColor }]}>Estado</ThemedText>
      <ThemedText
        style={[
          styles.statusValue,
          { backgroundColor: statusBackgroundColor, color: statusTextColor },
        ]}
      >
        {status?.label || 'Sin estado'}
      </ThemedText>

      <ThemedText style={[styles.label, { color: textColor }]}>Cliente</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{client?.business_name || 'Sin cliente'}</ThemedText>

      <ThemedText style={[styles.label, { color: textColor }]}>Carpeta</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{folder?.name || 'Sin carpeta'}</ThemedText>

      {job.type_of_work ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Tipo de trabajo</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{job.type_of_work}</ThemedText>
        </>
      ) : null}

      {job.job_date ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Fecha</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{job.job_date}</ThemedText>
        </>
      ) : null}

      <ThemedText style={[styles.label, { color: textColor }]}>Hora de inicio</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{startStr || 'Sin horario'}</ThemedText>

      <ThemedText style={[styles.label, { color: textColor }]}>Hora de fin</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{endStr || 'Sin horario'}</ThemedText>

      {interval ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Tiempo trabajado</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{interval}</ThemedText>
        </>
      ) : null}

      {participantNames.length ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Participantes</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{participantNames.join(', ')}</ThemedText>
        </>
      ) : null}

      {job.description ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Descripción</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{job.description}</ThemedText>
        </>
      ) : null}

      <ThemedText style={[styles.label, { color: textColor }]}>Nombre de la tarifa</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{tariff ? tariff.name : 'Tarifa manual'}</ThemedText>

      <ThemedText style={[styles.label, { color: textColor }]}>Monto</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>
        {tariff ? tariff.amount : job.manual_amount ?? 'Sin monto'}
      </ThemedText>

      {finalCost > 0 && (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Costo final</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>${finalCost.toFixed(2)}</ThemedText>
        </>
      )}

      {filesJson ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Archivos</ThemedText>
          <FileGallery filesJson={filesJson} onChangeFilesJson={() => {}} />
        </>
      ) : null}

      <ThemedText style={[styles.label, { color: textColor }]}>ID</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{job.id}</ThemedText>

      <View style={styles.editButton}>
        <ThemedButton title="Editar" onPress={() => router.push(`/jobs/${job.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  statusValue: { fontSize: 16, marginBottom: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  editButton: { marginTop: 16 },
});
