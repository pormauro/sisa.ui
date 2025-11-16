import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  GestureResponderEvent,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { CompanyMembershipsContext, CompanyMembership } from '@/contexts/CompanyMembershipsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SearchableSelect } from '@/components/SearchableSelect';
import { MembershipStatusBadge } from '@/components/MembershipStatusBadge';
import {
  MembershipLifecycleStatus,
  MEMBERSHIP_STATUS_OPTIONS,
  getMembershipStatusSortWeight,
} from '@/constants/companyMemberships';

type MembershipSortOption = 'updated' | 'company' | 'user' | 'status';
type StatusFilterValue = MembershipLifecycleStatus | 'all';

const SORT_OPTIONS: { label: string; value: MembershipSortOption }[] = [
  { label: 'Última actualización', value: 'updated' },
  { label: 'Empresa', value: 'company' },
  { label: 'Usuario', value: 'user' },
  { label: 'Estado', value: 'status' },
];

const getTimestamp = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export default function CompanyMembershipsListPage() {
  const router = useRouter();
  const {
    memberships,
    hydrated,
    loadCompanyMemberships,
    deleteCompanyMembership,
    loading,
  } = useContext(CompanyMembershipsContext);
  const { permissions } = useContext(PermissionsContext);

  const background = useThemeColor({}, 'background');
  const itemBorderColor = useThemeColor({ light: '#ececec', dark: '#333' }, 'background');
  const inputBackground = useThemeColor({ light: '#ffffff', dark: '#1d1d1d' }, 'background');
  const inputTextColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({ light: '#888888', dark: '#bbbbbb' }, 'text');
  const actionColor = useThemeColor({}, 'button');
  const actionTextColor = useThemeColor({}, 'buttonText');
  const spinnerColor = useThemeColor({}, 'tint');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState<MembershipSortOption>('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');

  const canList = permissions.includes('listCompanyMemberships');
  const canCreate = permissions.includes('addCompanyMembership');
  const canEdit = permissions.includes('updateCompanyMembership');
  const canDelete = permissions.includes('deleteCompanyMembership');
  const { refreshing, handleRefresh } = usePullToRefresh(loadCompanyMemberships, canList);

  useEffect(() => {
    if (!canList) {
      Alert.alert('Acceso denegado', 'No tienes permiso para ver membresías.');
      router.back();
    }
  }, [canList, router]);

  useFocusEffect(
    useCallback(() => {
      if (!canList) {
        return;
      }
      void loadCompanyMemberships();
    }, [canList, loadCompanyMemberships])
  );

  const statusFilterItems = useMemo(
    () => [
      { label: 'Todos los estados', value: 'all' as StatusFilterValue },
      ...MEMBERSHIP_STATUS_OPTIONS.map(option => ({ label: option.label, value: option.value })),
    ],
    []
  );

  const filteredMemberships = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const baseCollection = query
      ? memberships.filter(item => {
          const company = item.company_name?.toLowerCase() ?? '';
          const user = item.user_name?.toLowerCase() ?? '';
          const email = item.user_email?.toLowerCase() ?? '';
          const role = item.role?.toLowerCase() ?? '';
          const status = item.status?.toLowerCase() ?? '';
          const message = item.message?.toLowerCase() ?? '';
          const reason = item.reason?.toLowerCase() ?? '';
          return [company, user, email, role, status, message, reason].some(field =>
            field.includes(query)
          );
        })
      : memberships;

    const base =
      statusFilter === 'all'
        ? baseCollection
        : baseCollection.filter(item => (item.normalized_status ?? null) === statusFilter);

    const items = [...base];
    items.sort((a, b) => {
      switch (selectedSort) {
        case 'company':
          return a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' });
        case 'user':
          return a.user_name.localeCompare(b.user_name, undefined, { sensitivity: 'base' });
        case 'status':
          return (
            getMembershipStatusSortWeight(a.normalized_status ?? null) -
            getMembershipStatusSortWeight(b.normalized_status ?? null)
          );
        case 'updated':
        default:
          return getTimestamp(a.updated_at ?? a.created_at) - getTimestamp(b.updated_at ?? b.created_at);
      }
    });

    if (sortDirection === 'desc') {
      items.reverse();
    }

    return items;
  }, [
    memberships,
    searchQuery,
    selectedSort,
    sortDirection,
    statusFilter,
  ]);

  const handlePressItem = useCallback(
    (membership: CompanyMembership) => {
      if (canEdit) {
        router.push(`/company_memberships/${membership.id}`);
      } else {
        router.push(`/company_memberships/viewModal?id=${membership.id}`);
      }
    },
    [canEdit, router]
  );

  const handleDelete = useCallback(
    (membership: CompanyMembership) => {
      Alert.alert(
        'Eliminar membresía',
        'Esta acción quitará el acceso del usuario a la empresa seleccionada. ¿Deseas continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              setLoadingId(membership.id);
              await deleteCompanyMembership(membership.id);
              setLoadingId(null);
            },
          },
        ]
      );
    },
    [deleteCompanyMembership]
  );

  const handleDeletePress = useCallback(
    (event: GestureResponderEvent, membership: CompanyMembership) => {
      event.stopPropagation();
      handleDelete(membership);
    },
    [handleDelete]
  );

  const renderItem = useCallback(
    ({ item }: { item: CompanyMembership }) => (
      <TouchableOpacity
        style={[styles.itemContainer, { borderColor: itemBorderColor }]}
        onPress={() => handlePressItem(item)}
        onLongPress={() => canEdit && router.push(`/company_memberships/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.itemHeader}>
          <ThemedText style={styles.companyName}>{item.company_name}</ThemedText>
          <ThemedText style={styles.roleText}>{item.role ?? 'Sin rol'}</ThemedText>
        </View>
        <ThemedText style={styles.userName}>{item.user_name}</ThemedText>
        {item.user_email ? <ThemedText style={styles.userEmail}>{item.user_email}</ThemedText> : null}
        <View style={styles.statusRow}>
          <MembershipStatusBadge
            normalizedStatus={item.normalized_status ?? null}
            fallbackLabel={item.status ?? 'Sin estado'}
            size="sm"
          />
          {item.message ? (
            <ThemedText style={styles.statusMeta} numberOfLines={2}>
              Solicitud: {item.message}
            </ThemedText>
          ) : null}
        </View>
        {item.reason ? (
          <ThemedText style={styles.reasonText} numberOfLines={2}>
            Respuesta: {item.reason}
          </ThemedText>
        ) : null}
        <View style={styles.itemFooter}>
          <ThemedText style={styles.metaText}>
            Actualizado: {item.updated_at ? new Date(item.updated_at).toLocaleString() : 'N/D'}
          </ThemedText>
          {canDelete && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: actionColor }]}
              onPress={event => handleDeletePress(event, item)}
            >
              {loadingId === item.id ? (
                <ActivityIndicator color={actionTextColor} />
              ) : (
                <ThemedText style={[styles.deleteLabel, { color: actionTextColor }]}>Quitar</ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    ),
    [
      actionColor,
      actionTextColor,
      canDelete,
      canEdit,
      handleDeletePress,
      handlePressItem,
      itemBorderColor,
      loadingId,
      router,
    ]
  );

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Última actualización',
    [selectedSort]
  );

  const sortDirectionLabel = sortDirection === 'asc' ? 'Ascendente' : 'Descendente';

  const isLoading = loading || !hydrated;

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar por empresa, usuario o rol"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[
            styles.searchInput,
            { backgroundColor: inputBackground, color: inputTextColor },
          ]}
          placeholderTextColor={placeholderColor}
        />
        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: inputBackground }]}
          onPress={() =>
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
          }
        >
          <ThemedText style={[styles.sortButtonText, { color: inputTextColor }]}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.filterSelect}>
          <SearchableSelect
            items={statusFilterItems}
            selectedValue={statusFilter}
            onValueChange={value => {
              if (value === null) {
                setStatusFilter('all');
                return;
              }
              setStatusFilter(value as StatusFilterValue);
            }}
            placeholder="Filtrar por estado"
            showSearch={false}
          />
        </View>
      </View>

      <View style={styles.sortSummary}>
        <TouchableOpacity
          onPress={() => {
            const currentIndex = SORT_OPTIONS.findIndex(option => option.value === selectedSort);
            const nextOption = SORT_OPTIONS[(currentIndex + 1) % SORT_OPTIONS.length];
            setSelectedSort(nextOption.value);
            if (nextOption.value === 'updated') {
              setSortDirection('desc');
            }
          }}
        >
          <ThemedText style={styles.sortSummaryText}>
            Ordenado por {currentSortLabel} · {sortDirectionLabel}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={spinnerColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredMemberships}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedText style={styles.emptyStateText}>
              No se encontraron membresías para los filtros aplicados.
            </ThemedText>
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {canCreate && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: actionColor }]}
          onPress={() => router.push('/company_memberships/create')}
        >
          <ThemedText style={[styles.addButtonLabel, { color: actionTextColor }]}>Añadir membresía</ThemedText>
        </TouchableOpacity>
      )}
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
    gap: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  filtersRow: {
    marginBottom: 12,
  },
  filterSelect: {
    flex: 1,
  },
  sortButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  sortSummary: {
    marginBottom: 12,
  },
  sortSummaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyStateText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  },
  itemContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  userName: {
    fontSize: 15,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 4,
    opacity: 0.8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusMeta: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  reasonText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.7,
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  deleteLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    elevation: 2,
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

