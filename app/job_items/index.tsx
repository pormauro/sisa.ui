import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { JobItemsContext, type JobItem } from '@/contexts/JobItemsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useThemeColor } from '@/hooks/useThemeColor';

const sortByOrderIndex = (items: JobItem[]): JobItem[] => {
  return [...items].sort((a, b) => {
    if (a.order_index === b.order_index) {
      return a.id - b.id;
    }

    return a.order_index - b.order_index;
  });
};

export default function JobItemsScreen() {
  const { job_id } = useLocalSearchParams<{ job_id?: string }>();
  const router = useRouter();
  const { permissions } = useContext(PermissionsContext);
  const { jobItems, loadJobItems, deleteJobItem, updateJobItem } = useContext(JobItemsContext);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [editableItems, setEditableItems] = useState<JobItem[]>([]);
  const [originalItems, setOriginalItems] = useState<JobItem[]>([]);

  const canListJobItems = permissions.includes('listJobItems');
  const jobId = Number(job_id);
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#555' }, 'background');

  const visibleItems = useMemo(() => {
    const filtered = Number.isNaN(jobId) ? [] : jobItems.filter(item => item.job_id === jobId);
    return sortByOrderIndex(filtered);
  }, [jobId, jobItems]);

  useEffect(() => {
    if (canListJobItems && !Number.isNaN(jobId) && jobId > 0) {
      void loadJobItems(jobId);
    }
  }, [canListJobItems, jobId, loadJobItems]);

  useEffect(() => {
    if (!isEditingOrder) {
      setEditableItems(visibleItems);
    }
  }, [isEditingOrder, visibleItems]);

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

  const handleStartEditOrder = () => {
    setOriginalItems(visibleItems);
    setEditableItems(visibleItems);
    setIsEditingOrder(true);
  };

  const handleCancelEditOrder = () => {
    setEditableItems(originalItems);
    setIsEditingOrder(false);
    setIsSavingOrder(false);
  };

  const handleSaveEditOrder = async () => {
    if (!Number.isFinite(jobId) || jobId <= 0) {
      return;
    }

    const hasChanges = editableItems.some((item, index) => item.id !== originalItems[index]?.id);
    if (!hasChanges) {
      setIsEditingOrder(false);
      return;
    }

    setIsSavingOrder(true);
    try {
      for (let index = 0; index < editableItems.length; index += 1) {
        const item = editableItems[index];
        const nextOrderIndex = index + 1;

        if (item.order_index === nextOrderIndex && item.id === originalItems[index]?.id) {
          continue;
        }

        const ok = await updateJobItem(jobId, item.id, { order_index: nextOrderIndex });
        if (!ok) {
          throw new Error(`No se pudo actualizar el orden del item ${item.id}`);
        }
      }

      await loadJobItems(jobId);
      setIsEditingOrder(false);
    } catch (error) {
      console.error('Error saving job items order:', error);
      Alert.alert('Error', 'No se pudo guardar el nuevo orden.');
      setEditableItems(originalItems);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const renderRow = ({ item, drag, isActive }: RenderItemParams<JobItem>) => (
    <View style={[styles.row, { borderColor, opacity: isActive ? 0.8 : 1 }]}> 
      <View style={{ flex: 1 }}>
        {!!item.description && <ThemedText style={{ color: textColor }}>{item.description}</ThemedText>}
        <ThemedText style={{ color: textColor }}>Estado: {item.status}</ThemedText>
      </View>
      {isEditingOrder && (
        <TouchableOpacity
          onPressIn={drag}
          disabled={isSavingOrder}
          style={styles.dragHandle}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <ThemedText style={styles.dragHandleText}>≡</ThemedText>
        </TouchableOpacity>
      )}
      <View style={styles.actions}>
        {permissions.includes('updateJobItem') && (
          <TouchableOpacity
            disabled={isSavingOrder}
            onPress={() => router.push(`/job_items/${item.id}?job_id=${item.job_id}`)}
          >
            <ThemedText style={styles.edit}>Editar</ThemedText>
          </TouchableOpacity>
        )}
        {permissions.includes('deleteJobItem') && (
          <TouchableOpacity disabled={isSavingOrder} onPress={() => void handleDelete(item.id)}>
            <ThemedText style={styles.delete}>Eliminar</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );


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

      {permissions.includes('updateJobItem') && (
        <View style={styles.editOrderContainer}>
          {isEditingOrder ? (
            <>
              <TouchableOpacity style={styles.confirmButton} onPress={() => void handleSaveEditOrder()} disabled={isSavingOrder}>
                {isSavingOrder ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.confirmButtonText}>✓</ThemedText>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEditOrder} disabled={isSavingOrder}>
                <ThemedText style={styles.cancelButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.editOrderButton} onPress={handleStartEditOrder}>
              <ThemedText style={styles.editOrderButtonText}>Editar</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isEditingOrder ? (
        <DraggableFlatList
          data={editableItems}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<ThemedText style={{ color: textColor }}>No hay items cargados.</ThemedText>}
          renderItem={renderRow}
          onDragEnd={({ data }) => setEditableItems(data)}
          activationDistance={5}
        />
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<ThemedText style={{ color: textColor }}>No hay items cargados.</ThemedText>}
          renderItem={renderRow}
        />
      )}

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
  editOrderContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  editOrderButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editOrderButtonText: { color: '#fff', fontWeight: '600' },
  confirmButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 40,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 18, lineHeight: 20 },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#6b7280',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: { color: '#6b7280', fontWeight: '600' },
  row: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  dragHandle: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandleText: { fontSize: 22, color: '#6b7280', lineHeight: 22 },
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
