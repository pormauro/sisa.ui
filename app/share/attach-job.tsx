import React, { useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AuthContext } from '@/contexts/AuthContext';
import { Job, JobsContext } from '@/contexts/JobsContext';
import { useFiles } from '@/contexts/FilesContext';

const parseAttachedFiles = (value: Job['attached_files']): number[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(Number).filter(Number.isFinite);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter(Number.isFinite);
      }
    } catch {
      return [];
    }
  }

  return [];
};

const normalizeUriForUpload = async (uri: string): Promise<string> => {
  if (!uri.startsWith('content://')) {
    return uri;
  }

  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) {
    return uri;
  }

  const tempDir = `${base.endsWith('/') ? base : `${base}/`}tmp/`;
  await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => {});

  const destination = `${tempDir}shared_${Date.now()}`;
  await FileSystem.copyAsync({ from: uri, to: destination });

  return destination;
};

export default function AttachJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    uri?: string;
    name?: string;
    mime?: string;
    size?: string;
  }>();

  const { token, isOffline } = useContext(AuthContext);
  const { jobs, updateJob } = useContext(JobsContext);
  const { uploadFile } = useFiles();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const sharedUri = typeof params.uri === 'string' ? decodeURIComponent(params.uri) : '';
  const sharedName = typeof params.name === 'string' ? decodeURIComponent(params.name) : 'archivo';
  const sharedMime = typeof params.mime === 'string' ? decodeURIComponent(params.mime) : 'application/octet-stream';
  const sharedSize = typeof params.size === 'string' ? Number.parseInt(params.size, 10) || 0 : 0;

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return jobs.slice(0, 25);
    }

    return jobs.filter(job => {
      const description = job.description?.toLowerCase() ?? '';
      return description.includes(term) || String(job.id).includes(term);
    });
  }, [jobs, search]);

  const handleAttach = async (job: Job) => {
    if (!sharedUri) {
      Alert.alert('Sin archivo', 'No se encontró un archivo para adjuntar.');
      return;
    }

    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      const isConnected = Boolean(net.isConnected && net.isInternetReachable !== false);

      if (!token || isOffline || !isConnected) {
        Alert.alert('Sin conexión', 'Necesitas internet para adjuntar archivos desde compartir.');
        router.back();
        return;
      }

      const uploadUri = await normalizeUriForUpload(sharedUri);
      const uploaded = await uploadFile(uploadUri, sharedName, sharedMime, sharedSize);

      if (!uploaded?.id) {
        Alert.alert('Error', 'No se pudo subir el archivo compartido.');
        return;
      }

      const updatedAttachedFiles = [...parseAttachedFiles(job.attached_files), uploaded.id];

      const updated = await updateJob(job.id, {
        client_id: job.client_id,
        description: job.description,
        start_time: job.start_time,
        end_time: job.end_time,
        type_of_work: job.type_of_work,
        status_id: job.status_id,
        folder_id: job.folder_id,
        product_service_id: job.product_service_id,
        multiplicative_value: job.multiplicative_value,
        tariff_id: job.tariff_id,
        manual_amount: job.manual_amount,
        attached_files: updatedAttachedFiles,
        participants: job.participants,
        job_date: job.job_date,
        created_at: job.created_at,
        updated_at: job.updated_at,
      });

      if (!updated) {
        Alert.alert('Error', 'No se pudo actualizar el trabajo con el archivo.');
        return;
      }

      router.replace(`/jobs/${job.id}`);
    } catch (error) {
      console.error('Error al adjuntar archivo compartido', error);
      Alert.alert('Error', 'No se pudo completar el adjunto desde compartir.');
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>La recepción de archivos compartidos no está disponible en web.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adjuntar a Job</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por descripción o ID"
        value={search}
        onChangeText={setSearch}
        editable={!loading}
      />

      <FlatList
        data={filteredJobs}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={filteredJobs.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay trabajos para mostrar.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.jobItem, loading && styles.jobItemDisabled]}
            onPress={() => void handleAttach(item)}
            disabled={loading}
          >
            <Text style={styles.jobTitle}>#{item.id} · {item.description || 'Sin descripción'}</Text>
            <Text style={styles.jobSubtitle}>{item.job_date || 'Sin fecha'}</Text>
          </Pressable>
        )}
      />

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Subiendo y adjuntando archivo...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  jobItem: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  jobItemDisabled: {
    opacity: 0.6,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  jobSubtitle: {
    marginTop: 4,
    color: '#555',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#fff',
    fontWeight: '600',
  },
});
