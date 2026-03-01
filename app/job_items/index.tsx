import React, { useContext, useEffect } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { JobItemsContext } from '@/contexts/JobItemsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function JobItemsScreen() {
  const { job_id } = useLocalSearchParams<{ job_id?: string }>();
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const { jobItems, loadJobItems, deleteJobItem } = useContext(JobItemsContext);

  const canListJobItems = permissions.includes('listJobItems');
  const jobId = Number(job_id);
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#555' }, 'background');

  useEffect(() => {
    if (canListJobItems && !Number.isNaN(jobId) && jobId > 0) {
      void loadJobItems(jobId);
    }
  }, [canListJobItems, jobId, loadJobItems]);

  const handleDelete = async (id: number) => {
    Alert.alert('Eliminar item', '¿Seguro que quieres eliminar este item?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteJobItem(id);
          if (!ok) {
            Alert.alert('Error', 'No se pudo eliminar el item.');
            return;
          }

          if (!Number.isNaN(jobId) && jobId > 0) {
            await loadJobItems(jobId);
          }
        },
      },
    ]);
  };


  if (!canListJobItems) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={[styles.title, { color: textColor }]}>Items del trabajo</ThemedText>
        <ThemedText style={{ color: textColor }}>No tienes permiso para ver los items del trabajo.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={[styles.title, { color: textColor }]}>Items del trabajo</ThemedText>

      <FlatList
        data={jobItems}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<ThemedText style={{ color: textColor }}>No hay items cargados.</ThemedText>}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor }]}> 
            <View style={{ flex: 1 }}>
              {!!item.description && <ThemedText style={{ color: textColor }}>{item.description}</ThemedText>}
              <ThemedText style={{ color: textColor }}>Estado: {item.status}</ThemedText>
            </View>
            <View style={styles.actions}>
              {permissions.includes('updateJobItem') && (
                <TouchableOpacity onPress={() => router.push(`/job_items/${item.id}?job_id=${item.job_id}`)}>
                  <ThemedText style={styles.edit}>Editar</ThemedText>
                </TouchableOpacity>
              )}
              {permissions.includes('deleteJobItem') && (
                <TouchableOpacity onPress={() => void handleDelete(item.id)}>
                  <ThemedText style={styles.delete}>Eliminar</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {permissions.includes('addJobItem') && !Number.isNaN(jobId) && jobId > 0 && (
        <TouchableOpacity style={styles.button} onPress={() => router.push(`/job_items/create?job_id=${jobId}`)}>
          <ThemedText style={styles.buttonText}>+ Agregar item</ThemedText>
        </TouchableOpacity>
      )}

      {!Number.isNaN(jobId) && jobId > 0 && (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push(`/jobs/${jobId}`)}>
          <ThemedText style={styles.secondaryButtonText}>Volver al trabajo</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  listContent: { gap: 8, paddingBottom: 16 },
  row: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  description: { fontWeight: '600' },
  actions: { gap: 8, alignItems: 'flex-end' },
  edit: { color: '#3b82f6', fontWeight: '600' },
  delete: { color: '#ef4444', fontWeight: '600' },
  button: {
    marginTop: 16,
    backgroundColor: '#2C2546',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2C2546',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#2C2546', fontWeight: '600' },
});
