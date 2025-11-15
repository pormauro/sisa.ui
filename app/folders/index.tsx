// Archivo: app/folders/index.tsx

import React, { useContext, useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { FoldersContext, Folder } from '@/contexts/FoldersContext';
import { ClientsContext } from '@/contexts/ClientsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Ionicons } from '@expo/vector-icons';
import { useClientFinalizedJobTotals } from '@/hooks/useClientFinalizedJobTotals';

type ClientSortOption = 'name' | 'created' | 'updated' | 'finalizedJobs';

const SORT_OPTIONS: { label: string; value: ClientSortOption }[] = [
  { label: 'Nombre', value: 'name' },
  { label: 'Fecha de creación', value: 'created' },
  { label: 'Última modificación', value: 'updated' },
  { label: 'Trabajos finalizados', value: 'finalizedJobs' },
];

export default function FoldersPage() {
  const { folders, loadFolders, deleteFolder } = useContext(FoldersContext);
  const { clients, loadClients } = useContext(ClientsContext);
  const { permissions } = useContext(PermissionsContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState<ClientSortOption>('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const backButtonColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const spinnerColor = useThemeColor({}, 'tint');
  const filterButtonBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');

  const client_id = params.client_id as string | undefined;
  const parent_id = params.parent_id as string | undefined;

  const canAddFolder = permissions.includes('addFolder');
  const canDeleteFolder = permissions.includes('deleteFolder');
  const canEditFolder = permissions.includes('updateFolder');
  const isRootLevel = !client_id && !parent_id;

  const { getTotalForClient, hasFinalizedJobs } = useClientFinalizedJobTotals();

  const handleAddFolder = () => {
    if (client_id || parent_id) {
      const params: Record<string, string> = {};
      if (client_id) params.client_id = client_id;
      if (parent_id) params.parent_id = parent_id;
      router.push({ pathname: '/folders/create', params });
      return;
    }
    router.push('/folders/create');
  };

  const refreshLists = useCallback(async () => {
    await Promise.all([Promise.resolve(loadFolders()), Promise.resolve(loadClients())]);
  }, [loadFolders, loadClients]);

  const { refreshing, handleRefresh } = usePullToRefresh(refreshLists);

  useFocusEffect(
    useCallback(() => {
      void loadFolders();
      void loadClients();
    }, [loadFolders, loadClients])
  );

  const currentFolders: Folder[] = useMemo(() => {
    if (parent_id) {
      return folders.filter(f => f.parent_id === Number(parent_id));
    } else if (client_id) {
      return folders.filter(f => f.client_id === Number(client_id) && f.parent_id === null);
    } else {
      return []; // no folders, show clients instead
    }
  }, [folders, client_id, parent_id]);

  const fuseFolders = new Fuse(currentFolders, { keys: ['name'] });
  const filteredFolders = searchQuery ? fuseFolders.search(searchQuery).map(r => r.item) : currentFolders;

  const clientsWithComputedTotals = useMemo(
    () =>
      clients.map(client => {
        const computedTotal = getTotalForClient(client.id);
        const currentTotal = typeof client.unbilled_total === 'number' ? client.unbilled_total : 0;

        if (currentTotal === computedTotal) {
          return client;
        }

        if (computedTotal === 0 && (client.unbilled_total == null || client.unbilled_total === 0)) {
          return client;
        }

        return {
          ...client,
          unbilled_total: computedTotal,
        };
      }),
    [clients, getTotalForClient]
  );

  const fuseClients = useMemo(
    () =>
      new Fuse(clientsWithComputedTotals, {
        keys: ['business_name', 'tax_id', 'email', 'address'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [clientsWithComputedTotals]
  );

  const filteredClients = useMemo(() => {
    const baseClients = searchQuery
      ? fuseClients.search(searchQuery).map(result => result.item)
      : clientsWithComputedTotals;

    const result = [...baseClients];

    const getTimestamp = (value?: string | null) => {
      if (!value) {
        return 0;
      }
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    const getSafeTotal = (value: number | null | undefined) =>
      typeof value === 'number' && Number.isFinite(value) ? value : 0;

    let comparator: ((a: typeof baseClients[number], b: typeof baseClients[number]) => number) | null = null;

    switch (selectedSort) {
      case 'finalizedJobs':
        comparator = (a, b) => {
          const aHasJobs = hasFinalizedJobs(a.id) ? 1 : 0;
          const bHasJobs = hasFinalizedJobs(b.id) ? 1 : 0;
          if (aHasJobs !== bHasJobs) {
            return aHasJobs - bHasJobs;
          }
          return getSafeTotal(a.unbilled_total) - getSafeTotal(b.unbilled_total);
        };
        break;
      case 'name':
        comparator = (a, b) =>
          (a.business_name ?? '').localeCompare(b.business_name ?? '', undefined, {
            sensitivity: 'base',
          });
        break;
      case 'created':
        comparator = (a, b) => getTimestamp(a.created_at) - getTimestamp(b.created_at);
        break;
      case 'updated':
      default:
        comparator = (a, b) =>
          getTimestamp(a.updated_at ?? a.created_at) - getTimestamp(b.updated_at ?? b.created_at);
        break;
    }

    if (comparator) {
      result.sort((a, b) => {
        const comparison = comparator?.(a, b) ?? 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [
    clientsWithComputedTotals,
    fuseClients,
    searchQuery,
    selectedSort,
    sortDirection,
    hasFinalizedJobs,
  ]);

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Última modificación',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const handleSelectSort = useCallback((option: ClientSortOption) => {
    setSelectedSort(option);
    if (option === 'name') {
      setSortDirection('asc');
    } else {
      setSortDirection('desc');
    }
    setIsFilterModalVisible(false);
  }, []);

  const handleDelete = (id: number) => {
    Alert.alert('Confirmar eliminación', '¿Seguro deseas eliminar la carpeta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setLoadingId(id);
          await deleteFolder(id);
          setLoadingId(null);
        },
      },
    ]);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      {(client_id || parent_id) && (
        <TouchableOpacity style={[styles.backButton, { backgroundColor: backButtonColor }]} onPress={() => {
          if (parent_id) {
            const parentFolder = folders.find(f => f.id === Number(parent_id));
            if (parentFolder?.parent_id) {
              router.push({ pathname: '/folders', params: { parent_id: String(parentFolder.parent_id) } });
            } else {
              router.push({ pathname: '/folders', params: { client_id: String(parentFolder?.client_id ?? '') } });
            }
          } else if (client_id) {
            router.push('/folders');
          }
        }}>
          <ThemedText style={styles.backButtonText}>← Volver</ThemedText>
        </TouchableOpacity>
      )}

      <View style={[styles.searchRow, !isRootLevel && styles.searchRowStandalone]}>
        <TextInput
          placeholder={isRootLevel ? 'Buscar cliente...' : 'Buscar carpeta...'}
          style={[
            styles.searchInput,
            {
              backgroundColor: inputBackground,
              color: inputTextColor,
              borderColor,
            },
            !isRootLevel && styles.searchInputStandalone,
          ]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={placeholderColor}
        />
        {isRootLevel && (
          <>
            <TouchableOpacity
              style={[
                styles.sortDirectionButton,
                { backgroundColor: filterButtonBackground, borderColor },
              ]}
              onPress={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              accessibilityRole="button"
              accessibilityLabel="Cambiar dirección de orden"
            >
              <Ionicons
                name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={inputTextColor}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: filterButtonBackground, borderColor },
              ]}
              onPress={() => setIsFilterModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Abrir opciones de orden"
            >
              <Ionicons name="filter" size={20} color={inputTextColor} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {isRootLevel && (
        <View style={styles.filterSummaryRow}>
          <ThemedText style={styles.filterSummaryText}>
            Ordenado por {currentSortLabel} · {sortDirectionLabel}
          </ThemedText>
        </View>
      )}

      {client_id || parent_id ? (
        <FlatList
          data={filteredFolders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { borderColor: itemBorderColor }]}
              onPress={() => router.push({ pathname: '/folders', params: { parent_id: String(item.id) } })}
              onLongPress={() => canEditFolder && router.push(`/folders/${item.id}`)}>
              <CircleImagePicker fileId={item.folder_image_file_id} size={50} />
              <ThemedText style={[styles.text, { color: textColor }]}>{item.name}</ThemedText>
              {canDeleteFolder && (
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  {loadingId === item.id ? (
                    <ActivityIndicator color={spinnerColor} />
                  ) : (
                    <ThemedText style={styles.delete}>🗑️</ThemedText>
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: canAddFolder ? 120 : 0 }} />}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { borderColor: itemBorderColor }]}
              onPress={() => router.push({ pathname: '/folders', params: { client_id: String(item.id) } })}>
              <CircleImagePicker fileId={item.brand_file_id} size={50} />
              <ThemedText style={[styles.text, { color: textColor }]}>{item.business_name}</ThemedText>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: canAddFolder ? 120 : 0 }} />}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {canAddFolder && (
        <TouchableOpacity
          style={[styles.add, { backgroundColor: addButtonColor }]}
          onPress={handleAddFolder}
          accessibilityLabel={isRootLevel ? 'Agregar carpeta en la raíz' : 'Agregar carpeta'}
        >
          <ThemedText style={[styles.addText, { color: addButtonTextColor }]}>＋ Agregar carpeta</ThemedText>
        </TouchableOpacity>
      )}

      {isRootLevel && (
        <Modal
          transparent
          animationType="fade"
          visible={isFilterModalVisible}
          onRequestClose={() => setIsFilterModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsFilterModalVisible(false)} />
            <View style={[styles.modalContent, { backgroundColor: inputBackground, borderColor }]}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Filtro</ThemedText>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: addButtonColor }]}
                  onPress={() => setIsFilterModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar filtro"
                >
                  <Ionicons name="close" size={20} color={addButtonTextColor} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalSection}>
                {SORT_OPTIONS.map(option => {
                  const isSelected = option.value === selectedSort;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.modalOption,
                        isSelected && {
                          borderColor: addButtonColor,
                          backgroundColor: background,
                        },
                      ]}
                      onPress={() => handleSelectSort(option.value)}
                    >
                      <ThemedText
                        style={[
                          styles.modalOptionText,
                          isSelected && { color: addButtonColor, fontWeight: '600' },
                        ]}
                      >
                        {option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchRowStandalone: {
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  searchInputStandalone: {
    marginRight: 0,
  },
  item: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  text: { flex: 1, marginLeft: 10 },
  delete: { fontSize: 18 },
  add: { position: 'absolute', right: 16, bottom: 32, padding: 16, borderRadius: 30 },
  addText: { fontWeight: 'bold' },
  backButton: { marginBottom: 10, padding: 8, borderRadius: 8 },
  backButtonText: { fontSize: 16 },
  listContent: { paddingBottom: 16 },
  sortDirectionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  filterButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  filterSummaryRow: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  filterSummaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSection: {
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalCloseButton: {
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
