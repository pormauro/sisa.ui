import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Button } from 'react-native';
import { JobsContext } from '@/contexts/JobsContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { StatusesContext } from '@/contexts/StatusesContext';
import { TariffsContext } from '@/contexts/TariffsContext';

export default function ViewJobModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const router = useRouter();
  const { jobs } = useContext(JobsContext);
  const { clients } = useContext(ClientsContext);
  const { statuses } = useContext(StatusesContext);
  const { tariffs } = useContext(TariffsContext);

  const job = jobs.find(j => j.id === jobId);
  const client = clients.find(c => c.id === job?.client_id);
  const status = statuses.find(s => s.id === job?.status_id);
  const tariff = tariffs.find(t => t.id === job?.tariff_id);

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

      {job.type_of_work ? (
        <>
          <Text style={styles.label}>Tipo de trabajo</Text>
          <Text style={styles.value}>{job.type_of_work}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Estado</Text>
      <Text style={styles.value}>{status?.label || 'Sin estado'}</Text>

      <Text style={styles.label}>Tarifa</Text>
      <Text style={styles.value}>
        {tariff
          ? `${tariff.name} - ${tariff.amount}`
          : job.manual_amount
          ? `Manual: ${job.manual_amount}`
          : 'Sin tarifa'}
      </Text>

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
  editButton: { marginTop: 16 },
});
