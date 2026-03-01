import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JobItemsContext } from '@/contexts/JobItemsContext';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

type JobItemsSectionProps = {
  jobId: number;
  canListJobItems: boolean;
  permissions: string[];
  mode: 'edit' | 'view';
};

export function JobItemsSection({ jobId, canListJobItems, permissions, mode }: JobItemsSectionProps) {
  const { jobItems, loadJobItems, addJobItem, deleteJobItem, updateJobItem } = useContext(JobItemsContext);

  const [editingJobItemId, setEditingJobItemId] = useState<number | null>(null);
  const [editingJobItemDescription, setEditingJobItemDescription] = useState('');
  const [savingJobItemId, setSavingJobItemId] = useState<number | null>(null);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#999', dark: '#555' }, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const btnSaveColor = useThemeColor({}, 'button');

  const isEditMode = mode === 'edit';
  const visibleItems = useMemo(() => jobItems.filter(item => item.job_id === jobId), [jobId, jobItems]);

  useEffect(() => {
    if (!canListJobItems || !jobId || Number.isNaN(jobId)) {
      return;
    }

    void loadJobItems(jobId);
  }, [canListJobItems, jobId, loadJobItems]);

  const handleDeleteJobItem = useCallback(
    (itemId: number) => {
      Alert.alert('Eliminar item', '¿Seguro que querés eliminar este item?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteJobItem(itemId);
            if (ok) {
              void loadJobItems(jobId);
            } else {
              Alert.alert('Error', 'No se pudo eliminar el item.');
            }
          },
        },
      ]);
    },
    [deleteJobItem, jobId, loadJobItems]
  );

  const handleToggleJobItem = useCallback(
    async (itemId: number) => {
      const item = visibleItems.find(current => current.id === itemId);
      if (!item || !permissions.includes('updateJobItem')) {
        return;
      }

      const nextStatus = item.status === 'done' ? 'open' : 'done';
      const ok = await updateJobItem(jobId, itemId, { status: nextStatus });
      if (!ok) {
        Alert.alert('Error', 'No se pudo actualizar el item.');
        return;
      }

      void loadJobItems(jobId);
    },
    [visibleItems, jobId, loadJobItems, permissions, updateJobItem]
  );

  const handleStartInlineEditJobItem = useCallback(
    (itemId: number) => {
      if (!permissions.includes('updateJobItem')) {
        return;
      }

      const item = visibleItems.find(current => current.id === itemId);
      if (!item) {
        return;
      }

      setEditingJobItemId(itemId);
      setEditingJobItemDescription(item.description ?? '');
    },
    [permissions, visibleItems]
  );

  const handleSaveInlineEditJobItem = useCallback(async () => {
    if (!permissions.includes('updateJobItem') || editingJobItemId == null) {
      return;
    }

    const nextDescription = editingJobItemDescription.trim();
    if (!nextDescription) {
      Alert.alert('Descripción requerida', 'El item debe tener una descripción.');
      return;
    }

    setSavingJobItemId(editingJobItemId);
    const ok = await updateJobItem(jobId, editingJobItemId, { description: nextDescription });
    setSavingJobItemId(null);

    if (!ok) {
      Alert.alert('Error', 'No se pudo actualizar el item.');
      return;
    }

    setEditingJobItemId(null);
    setEditingJobItemDescription('');
    void loadJobItems(jobId);
  }, [editingJobItemDescription, editingJobItemId, jobId, loadJobItems, permissions, updateJobItem]);

  const handleCancelInlineEditJobItem = useCallback(() => {
    setEditingJobItemId(null);
    setEditingJobItemDescription('');
  }, []);

  const handleCreateInlineJobItem = useCallback(async () => {
    if (!permissions.includes('addJobItem') || isCreatingItem) {
      return;
    }

    const description = newItemDescription.trim();
    if (!description) {
      return;
    }

    setIsCreatingItem(true);
    const nextOrderIndex =
      visibleItems.length > 0 ? Math.max(...visibleItems.map(item => item.order_index || 0)) + 1 : 1;

    const ok = await addJobItem({
      job_id: jobId,
      description,
      status: 'open',
      order_index: nextOrderIndex,
    });
    setIsCreatingItem(false);

    if (!ok) {
      Alert.alert('Error', 'No se pudo crear el item.');
      return;
    }

    setNewItemDescription('');
    void loadJobItems(jobId);
  }, [addJobItem, isCreatingItem, jobId, loadJobItems, newItemDescription, permissions, visibleItems]);

  if (!canListJobItems) {
    return null;
  }

  return (
    <View style={styles.itemsContainer}>
      <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Items del trabajo</ThemedText>

      {visibleItems.length === 0 ? (
        <ThemedText style={{ color: textColor }}>No hay items cargados.</ThemedText>
      ) : (
        visibleItems.map(item => {
          const isEditingInline = editingJobItemId === item.id;
          const isSavingInline = savingJobItemId === item.id;

          const canDelete = isEditMode && permissions.includes('deleteJobItem');

          return (
            <View key={item.id} style={[styles.itemChecklistRow, { borderColor }]}>
              <Ionicons
                name={item.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={item.status === 'done' ? '#22c55e' : textColor}
              />

              {isEditMode && isEditingInline ? (
                <>
                  <TextInput
                    style={[
                      styles.itemInlineInput,
                      {
                        color: inputTextColor,
                        borderColor,
                        backgroundColor: inputBackground,
                      },
                    ]}
                    value={editingJobItemDescription}
                    onChangeText={setEditingJobItemDescription}
                    placeholder="Descripción del item"
                    placeholderTextColor={placeholderColor}
                    editable={!isSavingInline}
                  />
                  <View style={styles.itemActionsGroup}>
                    <TouchableOpacity
                      onPress={() => void handleSaveInlineEditJobItem()}
                      disabled={isSavingInline}
                      style={styles.actionIconButton}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      {isSavingInline ? (
                        <ActivityIndicator size="small" color={btnSaveColor} />
                      ) : (
                        <Ionicons name="checkmark" size={22} color={btnSaveColor} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCancelInlineEditJobItem}
                      disabled={isSavingInline}
                      style={styles.actionIconButton}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Ionicons name="close" size={22} color={placeholderColor} />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.itemTextPressable}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (isEditMode) {
                        void handleToggleJobItem(item.id);
                      }
                    }}
                    onLongPress={() => {
                      if (isEditMode) {
                        handleStartInlineEditJobItem(item.id);
                      }
                    }}
                    delayLongPress={350}
                    disabled={!isEditMode}
                  >
                    <ThemedText
                      style={[
                        styles.itemChecklistDescription,
                        { color: textColor },
                        item.status === 'done' && styles.itemChecklistDescriptionDone,
                      ]}
                    >
                      {item.description?.trim() || 'Sin descripción'}
                    </ThemedText>
                  </TouchableOpacity>

                  <View style={styles.itemActionsGroup}>
                    <View style={styles.actionIconButton} />
                    {canDelete ? (
                      <TouchableOpacity
                        onPress={() => handleDeleteJobItem(item.id)}
                        style={styles.actionIconButton}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.actionIconButton} />
                    )}
                  </View>
                </>
              )}
            </View>
          );
        })
      )}

      {isEditMode && permissions.includes('addJobItem') && (
        <View style={[styles.itemChecklistRow, { borderColor }]}>
          <Ionicons name="ellipse-outline" size={24} color={textColor} />
          <TextInput
            style={[
              styles.itemInlineInput,
              {
                color: inputTextColor,
                borderColor,
                backgroundColor: inputBackground,
              },
            ]}
            value={newItemDescription}
            onChangeText={setNewItemDescription}
            placeholder="Descripción del item"
            placeholderTextColor={placeholderColor}
            editable={!isCreatingItem}
          />
          <View style={styles.itemActionsGroup}>
            <TouchableOpacity
              onPress={() => void handleCreateInlineJobItem()}
              disabled={isCreatingItem || !newItemDescription.trim()}
              style={styles.actionIconButton}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              {isCreatingItem ? (
                <ActivityIndicator size="small" color={btnSaveColor} />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={22}
                  color={newItemDescription.trim() ? btnSaveColor : placeholderColor}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itemsContainer: { marginBottom: 28, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  itemChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  itemTextPressable: { flex: 1 },
  itemChecklistDescription: { fontSize: 15, flexShrink: 1 },
  itemChecklistDescriptionDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  itemInlineInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  itemActionsGroup: {
    minWidth: 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginLeft: 4,
  },
  actionIconButton: { width: 24, alignItems: 'center', justifyContent: 'center' },
});
