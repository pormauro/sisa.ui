// /app/clients/index.tsx
import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { ClientsContext, Client } from '@/contexts/ClientsContext';
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

const resolveSecondaryInfo = (client: Client): string | null => {
  const candidates = [client.email, client.tax_id, client.phone, client.address];
  for (const candidate of candidates) {
    if (candidate) {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

export default function ClientsListPage() {
  const {
    clients,
    loadClients,
    deleteClient,
    selectedClient,
    setSelectedClient,
  } = useContext(ClientsContext);
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
  const [hasClearedSelection, setHasClearedSelection] = useState(false);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');
  const selectedBorderColor = useThemeColor({}, 'tint');
  const selectedBackground = useThemeColor({ light: '#e8f0ff', dark: '#3b2f4c' }, 'background');
  const selectInfoBackground = useThemeColor({ light: '#f2f6ff', dark: '#2d223d' }, 'background');
  const selectInfoBorder = useThemeColor({ light: '#cdd7ff', dark: '#56466b' }, 'background');

  const canAddClient = permissions.includes('addClient');
  const canDeleteClient = permissions.includes('deleteClient');
  const canEditClient = permissions.includes('updateClient');

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
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (!isSelectMode) return;
    if (!selectedIdFromParams) return;
    if (hasClearedSelection) return;
    const found = clients.find(c => c.id === selectedIdFromParams);
    if (found && selectedClient?.id !== selectedIdFromParams) {
      setSelectedClient(found);
    }
  }, [
    clients,
    isSelectMode,
    selectedClient,
    selectedIdFromParams,
    setSelectedClient,
    hasClearedSelection,
  ]);

  useEffect(() => {
    setHasClearedSelection(false);
  }, [selectedIdFromParams]);

  const fuse = useMemo(
    () =>
      new Fuse<Client>(clients, {
        keys: [
          'business_name',
          { name: 'tax_id', getFn: (client) => client.tax_id ?? '' },
          { name: 'email', getFn: (client) => client.email ?? '' },
          { name: 'address', getFn: (client) => client.address ?? '' },
        ],
      }),
    [clients]
  );

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [clients, fuse, searchQuery]);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar este cliente?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              await deleteClient(id);
            },
          },
        ]
      );
    },
    [deleteClient]
  );

  const handleViewDetails = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      router.push(`/clients/viewModal?id=${id}`);
    },
    [router]
  );

  const handleEditClient = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      router.push(`/clients/${id}`);
    },
    [router]
  );

  const handleDeleteClient = useCallback(
    (event: GestureResponderEvent, id: number) => {
      event.stopPropagation();
      handleDelete(id);
    },
    [handleDelete]
  );

  const handleSelectClient = useCallback(
    (client: Client) => {
      if (!isSelectMode) {
        router.push(`/clients/viewModal?id=${client.id}`);
        return;
      }
      setHasClearedSelection(false);
      setSelectedClient(client);
      if (!stayOnSelect) {
        router.back();
      }
    },
    [
      isSelectMode,
      router,
      setSelectedClient,
      stayOnSelect,
      setHasClearedSelection,
    ]
  );

  const listHeader = isSelectMode ? (
    <View
      style={[
        styles.selectHeader,
        { backgroundColor: selectInfoBackground, borderColor: selectInfoBorder },
      ]}
    >
      <ThemedText style={styles.selectHeaderTitle}>Selecciona un cliente</ThemedText>
      <ThemedText style={styles.selectHeaderSubtitle}>
        Toca un cliente para seleccionarlo. Usa las acciones para ver, editar o eliminar sin perder tu selección.
      </ThemedText>
      {selectedClient && (
        <ThemedText style={styles.selectHeaderCurrent}>
          Cliente seleccionado: {selectedClient.business_name}
        </ThemedText>
      )}
      {selectedClient && (
        <TouchableOpacity
          style={[styles.clearSelectionButton, { borderColor }]}
          onPress={() => {
            setHasClearedSelection(true);
            setSelectedClient(null);
          }}
        >
          <ThemedText style={styles.clearSelectionText}>Limpiar selección</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  const renderItem = ({ item }: { item: Client }) => {
    const isSelected = isSelectMode && selectedClient?.id === item.id;

    const secondaryInfo = resolveSecondaryInfo(item);

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { borderColor: itemBorderColor },
          isSelected
            ? { borderColor: selectedBorderColor, backgroundColor: selectedBackground }
            : {},
        ]}
        onPress={() => handleSelectClient(item)}
        onLongPress={() => canEditClient && router.push(`/clients/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.itemContent}>
          <CircleImagePicker fileId={item.brand_file_id} size={50} />
          <View style={styles.itemInfo}>
            <ThemedText style={styles.itemTitle}>{item.business_name}</ThemedText>
            {secondaryInfo ? <ThemedText>{secondaryInfo}</ThemedText> : null}
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

          {canEditClient && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(event) => handleEditClient(event, item.id)}
            >
              <ThemedText style={styles.actionText}>✏️</ThemedText>
            </TouchableOpacity>
          )}

          {canDeleteClient && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(event) => handleDeleteClient(event, item.id)}
            >
              <ThemedText style={styles.actionText}>🗑️</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}> 
      <TextInput
        placeholder="Buscar cliente..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[
          styles.searchInput,
          { backgroundColor: inputBackground, color: inputTextColor, borderColor },
        ]}
        placeholderTextColor={placeholderColor}
      />
      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>No se encontraron clientes</ThemedText>
        }
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        extraData={selectedClient?.id}
      />
      {canAddClient && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/clients/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Cliente</ThemedText>
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
