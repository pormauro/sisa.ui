// C:/Users/Mauri/Documents/GitHub/router/app/cash_boxes/CashBoxesScreen.tsx
import React, {
  useContext,
  useState,
  useMemo,
  useEffect,
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { CashBoxesContext, CashBox } from '@/contexts/CashBoxesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const truthyValues = ['1', 'true', 'yes', 'on'];

const isTruthy = (value?: string) =>
  value ? truthyValues.includes(value.toLowerCase()) : false;

const parseParamValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default function CashBoxesScreen() {
  const {
    cashBoxes,
    loadCashBoxes,
    deleteCashBox,
    selectedCashBox,
    setSelectedCashBox,
  } = useContext(CashBoxesContext);
  const { permissions } = useContext(PermissionsContext);
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

  const canAddCashBox = permissions.includes('addCashBox');
  const canDeleteCashBox = permissions.includes('deleteCashBox');
  const canEditCashBox = permissions.includes('updateCashBox');

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
    if (!permissions.includes('listCashBoxes')) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver las cajas.');
      router.back();
    } else {
      loadCashBoxes();
    }
  }, [loadCashBoxes, permissions, router]);

  useEffect(() => {
    if (!isSelectMode) return;
    if (selectedIdFromParams === undefined) return;
    const found = cashBoxes.find(cb => cb.id === selectedIdFromParams);
    if (found && (!selectedCashBox || selectedCashBox.id !== found.id)) {
      setSelectedCashBox(found);
    }
  }, [
    cashBoxes,
    isSelectMode,
    selectedCashBox,
    selectedIdFromParams,
    setSelectedCashBox,
  ]);

  const fuse = useMemo(
    () =>
      new Fuse(cashBoxes, {
        keys: ['name'],
      }),
    [cashBoxes]
  );

  const filteredCashBoxes = useMemo(() => {
    if (!searchQuery) return cashBoxes;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [cashBoxes, fuse, searchQuery]);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert(
        'Confirmar eliminación',
        '¿Está seguro de que desea eliminar esta caja?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              setLoadingId(id);
              const success = await deleteCashBox(id);
              setLoadingId(null);
              if (!success) {
                Alert.alert('Error', 'No se pudo eliminar la caja');
              }
            },
          },
        ]
      );
    },
    [deleteCashBox]
  );

  const handleSelectCashBox = useCallback(
    (cashBox: CashBox) => {
      if (!isSelectMode) {
        router.push(`/cash_boxes/${cashBox.id}`);
        return;
      }
      setSelectedCashBox(cashBox);
      if (!stayOnSelect) {
        router.back();
      }
    },
    [isSelectMode, router, setSelectedCashBox, stayOnSelect]
  );

  const handleEditCashBox = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      router.push(`/cash_boxes/${id}`);
    },
    [router]
  );

  const handleDeleteCashBox = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      handleDelete(id);
    },
    [handleDelete]
  );

  const listHeader = isSelectMode ? (
    <View
      style={[
        styles.selectHeader,
        { backgroundColor: selectInfoBackground, borderColor: selectInfoBorder },
      ]}
    >
      <ThemedText style={styles.selectHeaderTitle}>Selecciona una caja</ThemedText>
      <ThemedText style={styles.selectHeaderSubtitle}>
        Toca una caja para seleccionarla. Usa las acciones para editar o eliminar sin perder tu
        selección.
      </ThemedText>
      {selectedCashBox && (
        <ThemedText style={styles.selectHeaderCurrent}>
          Caja seleccionada: {selectedCashBox.name}
        </ThemedText>
      )}
      {selectedCashBox && (
        <TouchableOpacity
          style={[styles.clearSelectionButton, { borderColor }]}
          onPress={() => setSelectedCashBox(null)}
        >
          <ThemedText style={styles.clearSelectionText}>Limpiar selección</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  const renderItem = ({ item }: { item: CashBox }) => {
    const isSelected = isSelectMode && selectedCashBox?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { borderColor: itemBorderColor },
          isSelected
            ? { borderColor: selectedBorderColor, backgroundColor: selectedBackground }
            : {},
        ]}
        onPress={() => handleSelectCashBox(item)}
        onLongPress={() => {
          if (!canEditCashBox) return;
          router.push(`/cash_boxes/${item.id}`);
        }}
        activeOpacity={0.85}
      >
        <View style={styles.itemContent}>
          <CircleImagePicker fileId={item.image_file_id} size={50} />
          <View style={styles.itemInfo}>
            <ThemedText style={styles.itemTitle}>{item.name}</ThemedText>
          </View>
        </View>

        {isSelected && (
          <ThemedText style={[styles.selectedIndicator, { color: selectedBorderColor }]}>✓</ThemedText>
        )}

        <View style={styles.actionsContainer}>
          {canEditCashBox && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(event) => handleEditCashBox(event, item.id)}
            >
              <ThemedText style={styles.actionText}>✏️</ThemedText>
            </TouchableOpacity>
          )}

          {canDeleteCashBox && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(event) => handleDeleteCashBox(event, item.id)}
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
        placeholder="Buscar caja..."
        style={[
          styles.searchInput,
          { backgroundColor: inputBackground, color: inputTextColor, borderColor },
        ]}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredCashBoxes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron cajas</ThemedText>
        }
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        extraData={selectedCashBox?.id}
      />
      {canAddCashBox && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/cash_boxes/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Caja</ThemedText>
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
