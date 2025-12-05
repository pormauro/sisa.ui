import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import CircleImagePicker from '@/components/CircleImagePicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { CompaniesContext, Company } from '@/contexts/CompaniesContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useSuperAdministrator } from '@/hooks/useSuperAdministrator';

const fuseOptions: Fuse.IFuseOptions<Company> = {
  threshold: 0.35,
  keys: [
    { name: 'legal_name', weight: 0.5 },
    { name: 'name', weight: 0.4 },
    { name: 'tax_id', weight: 0.3 },
    { name: 'addresses.city', weight: 0.3 },
    { name: 'addresses.state', weight: 0.2 },
  ],
  ignoreLocation: true,
};

type CompanySortOption = 'name' | 'created' | 'updated';

const SORT_OPTIONS: { label: string; value: CompanySortOption }[] = [
  { label: 'Nombre', value: 'name' },
  { label: 'Fecha de creación', value: 'created' },
  { label: 'Última modificación', value: 'updated' },
];

export default function CompaniesListPage() {
  const router = useRouter();
  const { companies, loadCompanies } = useContext(CompaniesContext);
  const { permissions } = useContext(PermissionsContext);
  const { normalizedUserId, isSuperAdministrator } = useSuperAdministrator();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedSort, setSelectedSort] = useState<CompanySortOption>('updated');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const canList = permissions.includes('listCompanies');
  const canCreate = permissions.includes('createCompany');
  const { refreshing, handleRefresh } = usePullToRefresh(loadCompanies, canList);

  const background = useThemeColor({}, 'background');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#666', dark: '#ccc' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'background');
  const itemBorderColor = useThemeColor({ light: '#eee', dark: '#444' }, 'background');
  const addButtonColor = useThemeColor({}, 'button');
  const addButtonTextColor = useThemeColor({}, 'buttonText');

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      void loadCompanies();
    }, [canList, loadCompanies])
  );

  const fuse = useMemo(() => {
    const source = canList ? companies : [];
    return new Fuse(source, fuseOptions);
  }, [canList, companies]);

  const filteredCompanies = useMemo(() => {
    if (!canList) {
      return [];
    }

    const baseList = (() => {
      if (!searchQuery.trim()) {
        return companies;
      }
      return fuse.search(searchQuery.trim()).map(result => result.item);
    })();

    const items = [...baseList];

    const getTimestamp = (value?: string | null) => {
      if (!value) {
        return 0;
      }
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    const getDisplayName = (company: Company) => {
      const commercial = (company.name ?? '').trim();
      const legal = (company.legal_name ?? '').trim();
      return commercial || legal || '';
    };

    const comparator: ((a: Company, b: Company) => number) | null = (() => {
      switch (selectedSort) {
        case 'name':
          return (a, b) =>
            getDisplayName(a).localeCompare(getDisplayName(b), undefined, {
              sensitivity: 'base',
            });
        case 'created':
          return (a, b) => getTimestamp(a.created_at) - getTimestamp(b.created_at);
        case 'updated':
        default:
          return (a, b) =>
            getTimestamp(a.updated_at ?? a.created_at) - getTimestamp(b.updated_at ?? b.created_at);
      }
    })();

    if (comparator) {
      items.sort((a, b) => {
        const comparison = comparator(a, b);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [canList, companies, fuse, searchQuery, selectedSort, sortDirection]);

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Última modificación',
    [selectedSort]
  );

  const sortDirectionLabel = useMemo(
    () => (sortDirection === 'asc' ? 'Ascendente' : 'Descendente'),
    [sortDirection]
  );

  const handleSelectSort = useCallback((option: CompanySortOption) => {
    setSelectedSort(option);
    if (option === 'name') {
      setSortDirection('asc');
    } else {
      setSortDirection('desc');
    }
    setIsFilterModalVisible(false);
  }, []);

  const actorCanAdministrate = useCallback(
    (company: Company) => {
      if (isSuperAdministrator) {
        return true;
      }
      if (!normalizedUserId) {
        return false;
      }
      if (!Array.isArray(company.administrator_ids) || !company.administrator_ids.length) {
        return false;
      }
      return company.administrator_ids.some(
        adminId => String(adminId).trim() === normalizedUserId
      );
    },
    [isSuperAdministrator, normalizedUserId]
  );

  const canEditCompany = useCallback(
    (company: Company) => actorCanAdministrate(company),
    [actorCanAdministrate]
  );

  const renderItem = ({ item }: { item: Company }) => {
    const commercialName = (item.name ?? '').trim() || (item.legal_name ?? '').trim();
    const allowEdit = canEditCompany(item);
    const subtitle = (item.tax_id ?? '').trim() || (item.email ?? '').trim() || (item.website ?? '').trim();

    return (
      <TouchableOpacity
        style={[styles.itemContainer, { borderColor: itemBorderColor }]}
        onPress={() => (canList ? router.push(`/companies/view?id=${item.id}`) : undefined)}
        onLongPress={() => {
          if (!allowEdit) {
            Alert.alert(
              'Acceso denegado',
              'Solo los administradores autorizados o el superadministrador pueden editar esta empresa.'
            );
            return;
          }
          router.push(`/companies/${item.id}`);
        }}
        activeOpacity={0.85}
        disabled={!canList}
      >
        <View style={styles.itemContent}>
          <CircleImagePicker
            fileId={item.profile_file_id ? String(item.profile_file_id) : null}
            size={50}
            editable={false}
          />
          <View style={styles.itemInfo}>
            {commercialName ? (
              <ThemedText style={styles.itemTitle}>{commercialName}</ThemedText>
            ) : null}
            {subtitle ? <ThemedText style={styles.itemSubtitle}>{subtitle}</ThemedText> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar empresa por razón social, CUIT o ciudad"
          value={searchQuery}
          onChangeText={setSearchQuery}
          editable={canList}
          style={[
            styles.searchInput,
            { backgroundColor: inputBackground, color: inputTextColor, borderColor },
          ]}
          placeholderTextColor={placeholderColor}
        />
        <TouchableOpacity
          style={[
            styles.sortDirectionButton,
            { backgroundColor: inputBackground, borderColor },
            !canList && styles.disabledControl,
          ]}
          onPress={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
          accessibilityRole="button"
          accessibilityLabel="Cambiar dirección de orden"
          disabled={!canList}
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
            { backgroundColor: inputBackground, borderColor },
            !canList && styles.disabledControl,
          ]}
          onPress={() => setIsFilterModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Abrir opciones de orden"
          disabled={!canList}
        >
          <Ionicons name="filter" size={20} color={inputTextColor} />
        </TouchableOpacity>
      </View>
      <View style={styles.filterSummaryRow}>
        <ThemedText style={styles.filterSummaryText}>
          Ordenado por {currentSortLabel} · {sortDirectionLabel}
        </ThemedText>
      </View>
      {canList ? (
        <FlatList
          data={filteredCompanies}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No se encontraron empresas</ThemedText>
          }
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: canCreate ? 120 : 0 }} />}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        <View style={styles.restrictedContainer}>
          <ThemedText style={styles.restrictedText}>
            No tienes permiso para listar empresas.
          </ThemedText>
        </View>
      )}
      {canCreate ? (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: addButtonColor }]}
          onPress={() => router.push('/companies/create')}
        >
          <ThemedText style={[styles.addButtonText, { color: addButtonTextColor }]}>➕ Agregar Empresa</ThemedText>
        </TouchableOpacity>
      ) : null}
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
                      { borderColor },
                      isSelected && {
                        borderColor: addButtonColor,
                        backgroundColor: background,
                      },
                    ]}
                    onPress={() => handleSelectSort(option.value)}
                    disabled={!canList}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  sortDirectionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  filterButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSummaryRow: {
    marginBottom: 12,
  },
  filterSummaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  disabledControl: {
    opacity: 0.6,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restrictedText: {
    textAlign: 'center',
    fontSize: 16,
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
  itemSubtitle: { fontSize: 14, marginTop: 2 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
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
