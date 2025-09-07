import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Button } from 'react-native';
import { JobsContext } from '@/contexts/JobsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { ProfilesContext } from '@/contexts/ProfilesContext';
import FileGallery from '@/components/FileGallery';
import { formatTimeInterval } from '@/utils/time';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ViewJobModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const router = useRouter();
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
  const buttonColor = useThemeColor({}, 'button');

  if (!job) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}> 
        <ThemedText style={{ color: textColor }}>Trabajo no encontrado</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: background }]}> 
      <ThemedText style={[styles.label, { color: textColor }]}>Cliente</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{client?.business_name || 'Sin cliente'}</ThemedText>

      {job.description ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Descripción</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{job.description}</ThemedText>
        </>
      ) : null}

      {job.job_date ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Fecha</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{job.job_date}</ThemedText>
        </>
      ) : null}

      <ThemedText style={[styles.label, { color: textColor }]}>Hora de inicio</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{job.start_time}</ThemedText>

      <ThemedText style={[styles.label, { color: textColor }]}>Hora de fin</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{job.end_time}</ThemedText>

      {interval ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Intervalo</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{interval}</ThemedText>
        </>
      ) : null}

      {job.type_of_work ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Tipo de trabajo</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{job.type_of_work}</ThemedText>
        </>
      ) : null}

      <ThemedText style={[styles.label, { color: textColor }]}>Estado</ThemedText>
      <ThemedText
        style={[
          styles.statusValue,
          { backgroundColor: status?.background_color || '#ccc' },
        ]}
      >
        {status?.label || 'Sin estado'}
      </ThemedText>

      <ThemedText style={[styles.label, { color: textColor }]}>Carpeta</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{folder?.name || 'Sin carpeta'}</ThemedText>

      <ThemedText style={[styles.label, { color: textColor }]}>Nombre de la tarifa</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{tariff ? tariff.name : 'Tarifa manual'}</ThemedText>

      <ThemedText style={[styles.label, { color: textColor }]}>Monto</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>
        {tariff ? tariff.amount : job.manual_amount ?? 'Sin monto'}
      </ThemedText>

      {participantNames.length ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Participantes</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>{participantNames.join(', ')}</ThemedText>
        </>
      ) : null}

      {filesJson ? (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Archivos</ThemedText>
          <FileGallery filesJson={filesJson} onChangeFilesJson={() => {}} />
        </>
      ) : null}

      {finalCost > 0 && (
        <>
          <ThemedText style={[styles.label, { color: textColor }]}>Costo final</ThemedText>
          <ThemedText style={[styles.value, { color: textColor }]}>${finalCost.toFixed(2)}</ThemedText>
        </>
      )}

      <ThemedText style={[styles.label, { color: textColor }]}>ID</ThemedText>
      <ThemedText style={[styles.value, { color: textColor }]}>{job.id}</ThemedText>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/jobs/${job.id}`)} color={buttonColor} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  statusValue: { fontSize: 16, marginBottom: 8, color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  editButton: { marginTop: 16 },
});
