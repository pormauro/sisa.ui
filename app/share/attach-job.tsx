import React, { useContext, useEffect, useMemo, useState } from 'react';
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
import { recordShareDebug } from '@/utils/shareDebug';

const normalizeUriForUpload = async (uri: string): Promise<string> => {
  if (!uri.startsWith('content://')) {
    recordShareDebug('attach-job:normalize-skip', { uri, reason: 'not-content-uri' });
    return uri;
  }

  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) {
    recordShareDebug('attach-job:normalize-skip', { uri, reason: 'missing-filesystem-base' });
    return uri;
  }

  const tempDir = `${base.endsWith('/') ? base : `${base}/`}tmp/`;
  await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => {});

  const destination = `${tempDir}shared_${Date.now()}`;
  await FileSystem.copyAsync({ from: uri, to: destination });

  recordShareDebug('attach-job:normalize-content-uri', { uri, destination });

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
  const { jobs } = useContext(JobsContext);
  const { uploadFile } = useFiles();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const sharedUri = typeof params.uri === 'string' ? decodeURIComponent(params.uri) : '';
  const sharedName = typeof params.name === 'string' ? decodeURIComponent(params.name) : 'archivo';
  const sharedMime = typeof params.mime === 'string' ? decodeURIComponent(params.mime) : 'application/octet-stream';
  const sharedSize = typeof params.size === 'string' ? Number.parseInt(params.size, 10) || 0 : 0;

  useEffect(() => {
    recordShareDebug('attach-job:params-decoded', {
      params,
      sharedUri,
      sharedName,
      sharedMime,
      sharedSize,
      jobsCount: jobs.length,
      isOffline,
      hasToken: Boolean(token),
    });
  }, [params, sharedUri, sharedName, sharedMime, sharedSize, jobs.length, isOffline, token]);

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
    recordShareDebug('attach-job:attach-start', {
      jobId: job.id,
      sharedUri,
      sharedName,
      sharedMime,
      sharedSize,
    });

    if (!sharedUri) {
      Alert.alert('Sin archivo', 'No se encontró un archivo para adjuntar.');
      return;
    }

    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      const isConnected = Boolean(net.isConnected && net.isInternetReachable !== false);

      recordShareDebug('attach-job:connectivity-check', {
        netInfo: net,
        isConnected,
        isOffline,
        hasToken: Boolean(token),
      });

      if (!token || isOffline || !isConnected) {
        Alert.alert('Sin conexión', 'Necesitas internet para adjuntar archivos desde compartir.');
        router.back();
        return;
      }

      const uploadUri = await normalizeUriForUpload(sharedUri);
      recordShareDebug('attach-job:normalized-uri', {
        sharedUri,
        uploadUri,
      });

      const uploaded = await uploadFile(uploadUri, sharedName, sharedMime, sharedSize);

      recordShareDebug('attach-job:upload-result', {
        uploaded,
      });

      if (!uploaded?.id) {
        Alert.alert('Error', 'No se pudo subir el archivo compartido.');
        return;
      }

      recordShareDebug('attach-job:navigate-to-job', {
        jobId: job.id,
        sharedFileId: uploaded.id,
      });

      router.replace({
        pathname: `/jobs/${job.id}`,
        params: { sharedFileId: String(uploaded.id) },
      });
    } catch (error) {
      recordShareDebug('attach-job:error', {
        error,
      });
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
