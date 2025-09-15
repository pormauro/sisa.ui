// app/providers/index.tsx
import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { ProvidersContext, Provider } from '@/contexts/ProvidersContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const truthyValues = ['1', 'true', 'yes', 'on'];

const isTruthy = (value?: string) =>
  value ? truthyValues.includes(value.toLowerCase()) : false;

const parseParamValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default function ProvidersListPage() {
  const {
    providers,
    loadProviders,
    deleteProvider,
    selectedProvider,
    setSelectedProvider,
  } = useContext(ProvidersContext);
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    select?: string;
    selectedId?: string;
    selected?: string;
    stay?: string;
    keepOpen?: string;
  }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const spinnerColor = useThemeColor({}, 'tint');
  const selectedBorderColor = useThemeColor({}, 'tint');
  const selectedBackground = useThemeColor({ light: '#e8f0ff', dark: '#3b2f4c' }, 'background');
  const selectInfoBackground = useThemeColor({ light: '#f2f6ff', dark: '#2d223d' }, 'background');
  const selectInfoBorder = useThemeColor({ light: '#cdd7ff', dark: '#56466b' }, 'background');

  const canAdd = permissions.includes('addProvider');
  const canDelete = permissions.includes('deleteProvider');
  const canEdit = permissions.includes('updateProvider');

  const selectParam = parseParamValue(params.mode) ?? parseParamValue(params.select);
  const isSelectMode = selectParam === 'select' || isTruthy(selectParam);

  const stayParam = parseParamValue(params.stay) ?? parseParamValue(params.keepOpen);
  const stayOnSelect = isTruthy(stayParam);

  const selectedIdParam =
    parseParamValue(params.selectedId) ?? parseParamValue(params.selected);
  const parsedSelectedId = selectedIdParam ? Number.parseInt(selectedIdParam, 10) : NaN;
  const selectedIdFromParams = Number.isNaN(parsedSelectedId)
    ? undefined
    : parsedSelectedId;

  useEffect(() => {
    if (!permissions.includes('listProviders')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver proveedores.');
      router.back();
    } else {
      loadProviders();
    }
  }, [permissions, loadProviders, router]);

  useEffect(() => {
    if (!isSelectMode) return;
    if (!selectedIdFromParams) return;
    const found = providers.find(provider => provider.id === selectedIdFromParams);
    if (found && (!selectedProvider || selectedProvider.id !== found.id)) {
      setSelectedProvider(found);
    }
  }, [
    providers,
    isSelectMode,
    selectedProvider,
    selectedIdFromParams,
    setSelectedProvider,
  ]);

  const fuse = useMemo(
    () =>
      new Fuse(providers, {
        keys: ['business_name', 'tax_id', 'email', 'address'],
      }),
    [providers]
  );

  const filteredProviders = useMemo(() => {
    if (!searchQuery) return providers;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [providers, fuse, searchQuery]);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Confirmar eliminación', '¿Eliminar este proveedor?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(id);
            await deleteProvider(id);
            setLoadingId(null);
          },
        },
      ]);
    },
    [deleteProvider]
  );

  const handleViewDetails = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      router.push(`/providers/viewModal?id=${id}`);
    },
    [router]
  );

  const handleEditProvider = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      router.push(`/providers/${id}`);
    },
    [router]
  );

  const handleDeleteProvider = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      handleDelete(id);
    },
    [handleDelete]
  );

  const handleSelectProvider = useCallback(
    (provider: Provider) => {
      if (!isSelectMode) {
        router.push(`/providers/viewModal?id=${provider.id}`);
        return;
      }
      setSelectedProvider(provider);
      if (!stayOnSelect) {
        router.back();
      }
    },
    [isSelectMode, router, setSelectedProvider, stayOnSelect]
  );

  const listHeader = isSelectMode ? (
    <View
      style={[
        styles.selectHeader,
        { backgroundColor: selectInfoBackground, borderColor: selectInfoBorder },
      ]}
    >
      <ThemedText style={styles.selectHeaderTitle}>Selecciona un proveedor</ThemedText>
      <ThemedText style={styles.selectHeaderSubtitle}>
        Toca un proveedor para seleccionarlo. Usa las acciones para ver, editar o eliminar sin perder tu selección.
      </ThemedText>
      {selectedProvider && (
        <ThemedText style={styles.selectHeaderCurrent}>
          Proveedor seleccionado: {selectedProvider.business_name}
        </ThemedText>
      )}
      {selectedProvider && (
        <TouchableOpacity
          style={[styles.clearSelectionButton, { borderColor }]}
          onPress={() => setSelectedProvider(null)}
        >
          <ThemedText style={styles.clearSelectionText}>Limpiar selección</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  const renderItem = ({ item }: { item: Provider }) => {
    const isSelected = isSelectMode && selectedProvider?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { borderColor: itemBorderColor },
          isSelected
            ? { borderColor: selectedBorderColor, backgroundColor: selectedBackground }
            : {},
        ]}
        onPress={() => handleSelectProvider(item)}
        activeOpacity={0.85}
      >
        <View style={styles.itemContent}>
          <CircleImagePicker fileId={item.brand_file_id} size={50} />
          <View style={styles.itemInfo}>
            <ThemedText style={styles.itemTitle}>{item.business_name}</ThemedText>
            <ThemedText>{item.email || ''}</ThemedText>
          </View>
        </View>

        {isSelected && (
          <ThemedText style={[styles.selectedIndicator, { color: selectedBorderColor }]}>✓</ThemedText>
        )}

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(event) => handleViewDetails(event, item.id)}
          >
            <ThemedText style={styles.actionText}>👁️</ThemedText>
          </TouchableOpacity>

          {canEdit && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(event) => handleEditProvider(event, item.id)}
            >
              <ThemedText style={styles.actionText}>✏️</ThemedText>
            </TouchableOpacity>
          )}

          {canDelete && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(event) => handleDeleteProvider(event, item.id)}
            >
              {loadingId === item.id ? (
                <ActivityIndicator color={spinnerColor} />
              ) : (
                <ThemedText style={styles.actionText}>🗑️</ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <TextInput
        placeholder="Buscar proveedor..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[
          styles.searchInput,
          { backgroundColor: inputBackground, color: inputTextColor, borderColor },
        ]}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredProviders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron proveedores</ThemedText>
        }
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        extraData={selectedProvider?.id}
      />
      {canAdd && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/providers/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Proveedor</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingBottom: 80 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 120,
  },
  selectHeader: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  selectHeaderSubtitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  selectHeaderCurrent: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  clearSelectionButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  clearSelectionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: { padding: 6, marginLeft: 4 },
  actionText: { fontSize: 18 },
  selectedIndicator: { fontSize: 18, fontWeight: 'bold', marginLeft: 6 },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
