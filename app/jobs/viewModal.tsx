import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import { JobsContext } from '@/contexts/JobsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';
import { FoldersContext } from '@/contexts/FoldersContext';
import { ProfilesContext } from '@/contexts/ProfilesContext';
import FileGallery from '@/components/FileGallery';
import { formatTimeInterval } from '@/utils/time';

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

  if (!job) {
    return (
      <View style={styles.container}>
        <Text>Trabajo no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Cliente</Text>
      <Text style={styles.value}>{client?.business_name || 'Sin cliente'}</Text>

      {job.description ? (
        <>
          <Text style={styles.label}>Descripción</Text>
          <Text style={styles.value}>{job.description}</Text>
        </>
      ) : null}

      {job.job_date ? (
        <>
          <Text style={styles.label}>Fecha</Text>
          <Text style={styles.value}>{job.job_date}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Hora de inicio</Text>
      <Text style={styles.value}>{job.start_time}</Text>

      <Text style={styles.label}>Hora de fin</Text>
      <Text style={styles.value}>{job.end_time}</Text>

      {interval ? (
        <>
          <Text style={styles.label}>Intervalo</Text>
          <Text style={styles.value}>{interval}</Text>
        </>
      ) : null}

      {job.type_of_work ? (
        <>
          <Text style={styles.label}>Tipo de trabajo</Text>
          <Text style={styles.value}>{job.type_of_work}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Estado</Text>
      <Text
        style={[
          styles.statusValue,
          { backgroundColor: status?.background_color || '#ccc' },
        ]}
      >
        {status?.label || 'Sin estado'}
      </Text>

      <Text style={styles.label}>Carpeta</Text>
      <Text style={styles.value}>{folder?.name || 'Sin carpeta'}</Text>

      <Text style={styles.label}>Nombre de la tarifa</Text>
      <Text style={styles.value}>{tariff ? tariff.name : 'Tarifa manual'}</Text>

      <Text style={styles.label}>Monto</Text>
      <Text style={styles.value}>
        {tariff ? tariff.amount : job.manual_amount ?? 'Sin monto'}
      </Text>

      {participantNames.length ? (
        <>
          <Text style={styles.label}>Participantes</Text>
          <Text style={styles.value}>{participantNames.join(', ')}</Text>
        </>
      ) : null}

      {filesJson ? (
        <>
          <Text style={styles.label}>Archivos</Text>
          <FileGallery filesJson={filesJson} onChangeFilesJson={() => {}} />
        </>
      ) : null}

      {finalCost > 0 && (
        <>
          <Text style={styles.label}>Costo final</Text>
          <Text style={styles.value}>${finalCost.toFixed(2)}</Text>
        </>
      )}

      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{job.id}</Text>

      <View style={styles.editButton}>
        <Button title="Editar" onPress={() => router.push(`/jobs/${job.id}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  label: { marginTop: 8, fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, marginBottom: 8 },
  statusValue: { fontSize: 16, marginBottom: 8, color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  editButton: { marginTop: 16 },
});
