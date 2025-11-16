import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  GestureResponderEvent,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import ExpoCheckbox from 'expo-checkbox';
import * as Clipboard from 'expo-clipboard';

import { CompanyMembershipsContext, CompanyMembership } from '@/contexts/CompanyMembershipsContext';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SearchableSelect } from '@/components/SearchableSelect';
import { MembershipStatusBadge } from '@/components/MembershipStatusBadge';
import {
  MEMBERSHIP_STATUS_OPTIONS,
  getMembershipStatusSortWeight,
} from '@/constants/companyMemberships';
import {
  MembershipSortOption,
  StatusFilterValue,
  type MembershipFilterState,
} from '@/app/company_memberships/filterTypes';
import {
  deleteView,
  loadLastFilters,
  loadSavedViews,
  persistLastFilters,
  saveNewView,
  touchViewUsage,
  type MembershipSavedView,
} from '@/app/company_memberships/filterStorage';

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

interface QuickViewDefinition extends MembershipFilterState {
  id: string;
  label: string;
}

export default function CompanyMembershipsListPage() {
  const router = useRouter();
  const {
    memberships,
    hydrated,
    loadCompanyMemberships,
    deleteCompanyMembership,
    loading,
    updateMembershipStatus,
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
  const [savedViews, setSavedViews] = useState<MembershipSavedView[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [viewNameInput, setViewNameInput] = useState('');
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [lastAppliedViewId, setLastAppliedViewId] = useState<string | null>(null);

  const canList = permissions.includes('listCompanyMemberships');
  const canCreate = permissions.includes('addCompanyMembership');
  const canEdit = permissions.includes('updateCompanyMembership');
  const canDelete = permissions.includes('deleteCompanyMembership');
  const canBulkManage = canEdit || canDelete;
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

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [storedFilters, storedViews] = await Promise.all([
          loadLastFilters(),
          loadSavedViews(),
        ]);
        if (!mounted) {
          return;
        }
        if (storedFilters) {
          if (typeof storedFilters.searchQuery === 'string') {
            setSearchQuery(storedFilters.searchQuery);
          }
          if (storedFilters.selectedSort) {
            setSelectedSort(storedFilters.selectedSort as MembershipSortOption);
          }
          if (storedFilters.sortDirection) {
            setSortDirection(storedFilters.sortDirection);
          }
          if (storedFilters.statusFilter) {
            setStatusFilter(storedFilters.statusFilter as StatusFilterValue);
          }
        }
        setSavedViews(storedViews);
      } catch (error) {
        console.error('Error cargando filtros persistentes', error);
      } finally {
        if (mounted) {
          setFiltersHydrated(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!filtersHydrated) {
      return;
    }
    const payload: MembershipFilterState = {
      searchQuery,
      selectedSort,
      sortDirection,
      statusFilter,
    };
    void persistLastFilters(payload);
  }, [filtersHydrated, searchQuery, selectedSort, sortDirection, statusFilter]);


  const statusFilterItems = useMemo(
    () => [
      { label: 'Todos los estados', value: 'all' as StatusFilterValue },
      ...MEMBERSHIP_STATUS_OPTIONS.map(option => ({ label: option.label, value: option.value })),
    ],
    []
  );

  const buildFilterState = useCallback(
    (): MembershipFilterState => ({
      searchQuery,
      selectedSort,
      sortDirection,
      statusFilter,
    }),
    [searchQuery, selectedSort, sortDirection, statusFilter]
  );

  const applyFilterState = useCallback(
    (state: Partial<MembershipFilterState>) => {
      if (state.searchQuery !== undefined) {
        setSearchQuery(state.searchQuery);
      }
      if (state.selectedSort) {
        setSelectedSort(state.selectedSort);
      }
      if (state.sortDirection) {
        setSortDirection(state.sortDirection);
      }
      if (state.statusFilter) {
        setStatusFilter(state.statusFilter);
      }
      setSelectedIds([]);
    },
    [setSelectedIds]
  );

  const matchesCurrentFilters = useCallback(
    (state: MembershipFilterState) =>
      state.searchQuery === searchQuery &&
      state.selectedSort === selectedSort &&
      state.sortDirection === sortDirection &&
      state.statusFilter === statusFilter,
    [searchQuery, selectedSort, sortDirection, statusFilter]
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

  useEffect(() => {
    setSelectedIds(prev =>
      prev.filter(id => filteredMemberships.some(item => item.id === id))
    );
  }, [filteredMemberships]);

  const quickViewItems = useMemo<QuickViewDefinition[]>(() => {
    if (!memberships.length) {
      return [];
    }
    const items: QuickViewDefinition[] = [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const stalePending = memberships.filter(item => {
      if ((item.normalized_status ?? null) !== 'pending') {
        return false;
      }
      const updated = getTimestamp(item.updated_at ?? item.created_at);
      return updated > 0 && updated < sevenDaysAgo;
    }).length;
    if (stalePending > 0) {
      items.push({
        id: 'stale-pending',
        label: `Pendientes +7 días (${stalePending})`,
        searchQuery: '',
        selectedSort: 'updated',
        sortDirection: 'asc',
        statusFilter: 'pending',
      });
    }

    const companyMap = new Map<
      string,
      { id: string; name: string; count: number }
    >();
    memberships.forEach(item => {
      const key = String(item.company_id ?? item.company_name ?? item.id);
      const existing = companyMap.get(key) ?? {
        id: `company-${key}`,
        name: item.company_name || `Empresa #${item.company_id ?? 'N/D'}`,
        count: 0,
      };
      existing.count += 1;
      existing.name = item.company_name || existing.name;
      companyMap.set(key, existing);
    });
    const topCompanies = Array.from(companyMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    topCompanies.forEach(company => {
      items.push({
        id: company.id,
        label: `${company.name} (${company.count})`,
        searchQuery: company.name,
        selectedSort: 'user',
        sortDirection: 'asc',
        statusFilter: 'all',
      });
    });
    return items;
  }, [memberships]);

  const statusLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    MEMBERSHIP_STATUS_OPTIONS.forEach(option => {
      map.set(option.value, option.label);
    });
    return map;
  }, []);

  const statusKpis = useMemo(() => {
    const totals = new Map<string, number>();
    filteredMemberships.forEach(item => {
      const key = item.normalized_status ?? 'unknown';
      totals.set(key, (totals.get(key) ?? 0) + 1);
    });
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([key, count]) => ({
        key,
        count,
        label: statusLabelMap.get(key) ?? 'Sin estado',
      }));
  }, [filteredMemberships, statusLabelMap]);

  const roleKpis = useMemo(() => {
    const totals = new Map<string, { count: number; label: string }>();
    filteredMemberships.forEach(item => {
      const rawLabel = item.role?.trim() || 'Sin rol';
      const key = rawLabel.toLowerCase();
      const entry = totals.get(key) ?? { count: 0, label: rawLabel };
      entry.count += 1;
      entry.label = rawLabel;
      totals.set(key, entry);
    });
    return Array.from(totals.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4)
      .map(([key, value]) => ({
        key,
        count: value.count,
        label: value.label,
      }));
  }, [filteredMemberships]);

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

  const handleApplyQuickView = useCallback(
    (view: QuickViewDefinition) => {
      applyFilterState(view);
      setLastAppliedViewId(null);
    },
    [applyFilterState]
  );

  const handleApplySavedView = useCallback(
    (view: MembershipSavedView) => {
      applyFilterState(view);
      setLastAppliedViewId(view.id);
      void touchViewUsage(view.id)
        .then(setSavedViews)
        .catch(error => console.error('Error actualizando el uso de la vista', error));
    },
    [applyFilterState]
  );

  const handleShareSavedView = useCallback(async (view: MembershipSavedView) => {
    try {
      const payload = {
        name: view.name,
        filters: {
          searchQuery: view.searchQuery,
          selectedSort: view.selectedSort,
          sortDirection: view.sortDirection,
          statusFilter: view.statusFilter,
        },
      };
      await Clipboard.setStringAsync(JSON.stringify(payload));
      Alert.alert('Vista copiada', 'Los filtros se copiaron al portapapeles.');
    } catch (error) {
      console.error('Error compartiendo la vista', error);
      Alert.alert('Error', 'No pudimos copiar la vista. Intenta nuevamente.');
    }
  }, []);

  const handleDeleteSavedView = useCallback(
    (view: MembershipSavedView) => {
      Alert.alert(
        'Eliminar vista guardada',
        `¿Deseas eliminar "${view.name}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                const updated = await deleteView(view.id);
                setSavedViews(updated);
                if (lastAppliedViewId === view.id) {
                  setLastAppliedViewId(null);
                }
              } catch (error) {
                console.error('Error eliminando vista guardada', error);
                Alert.alert('Error', 'No se pudo eliminar la vista seleccionada.');
              }
            },
          },
        ]
      );
    },
    [lastAppliedViewId]
  );

  const handleSaveView = useCallback(async () => {
    const trimmed = viewNameInput.trim();
    if (!trimmed) {
      Alert.alert('Nombre requerido', 'Asigna un nombre a la vista para guardarla.');
      return;
    }
    try {
      const updated = await saveNewView(trimmed, buildFilterState());
      setSavedViews(updated);
      const newView = updated[updated.length - 1];
      setLastAppliedViewId(newView?.id ?? null);
      setSavingView(false);
      setViewNameInput('');
    } catch (error) {
      console.error('Error guardando vista', error);
      Alert.alert('Error', 'No pudimos guardar la vista seleccionada.');
    }
  }, [buildFilterState, viewNameInput]);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(current => current !== id) : [...prev, id]
    );
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(filteredMemberships.map(item => item.id));
  }, [filteredMemberships]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleBulkDecision = useCallback(
    (decision: 'approve' | 'reject') => {
      const ids = [...selectedIds];
      if (!ids.length) {
        return;
      }
      const status = decision === 'approve' ? 'approved' : 'rejected';
      Alert.alert(
        decision === 'approve' ? 'Aprobar solicitudes' : 'Rechazar solicitudes',
        `Se actualizarán ${ids.length} membresías.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: decision === 'approve' ? 'Aprobar' : 'Rechazar',
            style: decision === 'approve' ? 'default' : 'destructive',
            onPress: async () => {
              setBulkActionLoading(true);
              const idsSet = new Set(ids);
              try {
                for (const id of ids) {
                  await updateMembershipStatus(id, status, { decision });
                }
                setSelectedIds(prev => prev.filter(value => !idsSet.has(value)));
              } catch (error) {
                console.error('Error en la acción masiva', error);
                Alert.alert('Error', 'No pudimos completar la acción seleccionada.');
              } finally {
                setBulkActionLoading(false);
              }
            },
          },
        ]
      );
    },
    [selectedIds, updateMembershipStatus]
  );

  const handleBulkDelete = useCallback(() => {
    const ids = [...selectedIds];
    if (!ids.length) {
      return;
    }
    Alert.alert(
      'Eliminar membresías',
      `Esta acción quitará ${ids.length} accesos. ¿Deseas continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setBulkActionLoading(true);
            const idsSet = new Set(ids);
            try {
              for (const id of ids) {
                await deleteCompanyMembership(id);
              }
              setSelectedIds(prev => prev.filter(value => !idsSet.has(value)));
            } catch (error) {
              console.error('Error eliminando en lote', error);
              Alert.alert(
                'Error',
                'No pudimos eliminar todas las membresías seleccionadas.'
              );
            } finally {
              setBulkActionLoading(false);
            }
          },
        },
      ]
    );
  }, [deleteCompanyMembership, selectedIds]);

  const renderItem = useCallback(
    ({ item }: { item: CompanyMembership }) => {
      const isSelected = selectedIds.includes(item.id);
      return (
        <TouchableOpacity
          style={[
            styles.itemContainer,
            { borderColor: itemBorderColor },
            isSelected && { borderColor: actionColor },
          ]}
          onPress={() => handlePressItem(item)}
          onLongPress={() => canEdit && router.push(`/company_memberships/${item.id}`)}
          activeOpacity={0.85}
        >
          <View style={styles.itemHeader}>
            <View style={styles.itemHeaderInfo}>
              <ThemedText style={styles.companyName}>{item.company_name}</ThemedText>
              <ThemedText style={styles.roleText}>{item.role ?? 'Sin rol'}</ThemedText>
            </View>
            {canBulkManage ? (
              <TouchableOpacity
                style={styles.checkboxWrapper}
                onPress={event => {
                  event.stopPropagation();
                  toggleSelection(item.id);
                }}
                onLongPress={event => {
                  event.stopPropagation();
                  toggleSelection(item.id);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <ExpoCheckbox
                  value={isSelected}
                  onValueChange={() => toggleSelection(item.id)}
                  color={actionColor}
                />
              </TouchableOpacity>
            ) : null}
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
      );
    },
    [
      actionColor,
      actionTextColor,
      canBulkManage,
      canDelete,
      canEdit,
      handleDeletePress,
      handlePressItem,
      itemBorderColor,
      loadingId,
      router,
      selectedIds,
      toggleSelection,
    ]
  );

  const selectedCount = selectedIds.length;
  const totalVisible = filteredMemberships.length;
  const allVisibleSelected = totalVisible > 0 && selectedCount === totalVisible;
  const showBulkBar = canBulkManage && selectedCount > 0;
  const savedViewsAvailable = savedViews.length > 0;

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find(option => option.value === selectedSort)?.label ?? 'Última actualización',
    [selectedSort]
  );

  const sortDirectionLabel = sortDirection === 'asc' ? 'Ascendente' : 'Descendente';

  const isLoading = loading || !hydrated || !filtersHydrated;

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

      <View style={styles.kpiSection}>
        <ThemedText style={styles.sectionTitle}>KPIs del filtro</ThemedText>
        {statusKpis.length ? (
          <View style={styles.kpiRow}>
            {statusKpis.map(item => (
              <View key={item.key} style={[styles.kpiCard, { borderColor: itemBorderColor }]}>
                <ThemedText style={styles.kpiLabel}>{item.label}</ThemedText>
                <ThemedText style={styles.kpiValue}>{item.count}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.emptyKpiText}>
            No hay resultados para los filtros actuales.
          </ThemedText>
        )}
        {roleKpis.length ? (
          <View style={[styles.kpiRow, styles.kpiRowSpacing]}>
            {roleKpis.map(item => (
              <View
                key={`role-${item.key}`}
                style={[styles.kpiCard, styles.kpiCardMuted, { borderColor: itemBorderColor }]}
              >
                <ThemedText style={styles.kpiLabel}>{item.label}</ThemedText>
                <ThemedText style={styles.kpiValue}>{item.count}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {quickViewItems.length ? (
        <View style={styles.quickViewsContainer}>
          <ThemedText style={styles.sectionTitle}>Vistas rápidas</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickViewsContent}
          >
            {quickViewItems.map(view => {
              const isActive = matchesCurrentFilters(view);
              return (
                <TouchableOpacity
                  key={view.id}
                  style={[
                    styles.quickViewChip,
                    { borderColor: itemBorderColor },
                    isActive && styles.quickViewChipActive,
                    isActive && { backgroundColor: actionColor, borderColor: actionColor },
                  ]}
                  onPress={() => handleApplyQuickView(view)}
                >
                  <ThemedText
                    style={[
                      styles.quickViewText,
                      isActive && styles.quickViewTextActive,
                      isActive && { color: actionTextColor },
                    ]}
                  >
                    {view.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.savedViewsSection}>
        <View style={styles.savedViewsHeader}>
          <ThemedText style={styles.sectionTitle}>Vistas guardadas</ThemedText>
          <TouchableOpacity
            style={[styles.saveViewToggle, { borderColor: itemBorderColor }]}
            onPress={() => {
              if (savingView) {
                setSavingView(false);
                setViewNameInput('');
              } else {
                setSavingView(true);
              }
            }}
          >
            <ThemedText style={styles.saveViewToggleText}>
              {savingView ? 'Cancelar' : 'Guardar actual'}
            </ThemedText>
          </TouchableOpacity>
        </View>
        {savingView ? (
          <View style={[styles.saveViewForm, { borderColor: itemBorderColor }]}>
            <TextInput
              value={viewNameInput}
              onChangeText={setViewNameInput}
              placeholder="Ej. Solicitudes urgentes"
              placeholderTextColor={placeholderColor}
              style={[
                styles.saveViewInput,
                { backgroundColor: inputBackground, color: inputTextColor },
              ]}
            />
            <TouchableOpacity
              style={[styles.saveViewButton, { backgroundColor: actionColor }]}
              onPress={handleSaveView}
            >
              <ThemedText
                style={[styles.saveViewButtonLabel, { color: actionTextColor }]}
              >
                Guardar
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}
        {savedViewsAvailable ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedViewsContent}
          >
            {savedViews.map(view => {
              const isActive = matchesCurrentFilters(view);
              return (
                <View
                  key={view.id}
                  style={[
                    styles.savedViewChip,
                    { borderColor: itemBorderColor },
                    isActive && styles.savedViewChipActive,
                  ]}
                >
                  <TouchableOpacity onPress={() => handleApplySavedView(view)}>
                    <ThemedText style={styles.savedViewName}>{view.name}</ThemedText>
                  </TouchableOpacity>
                  <View style={styles.savedViewActions}>
                    <TouchableOpacity onPress={() => handleShareSavedView(view)}>
                      <ThemedText style={styles.savedViewActionText}>Copiar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteSavedView(view)}>
                      <ThemedText style={styles.savedViewActionDelete}>×</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <ThemedText style={styles.savedViewsEmptyText}>
            Aún no guardas vistas personalizadas.
          </ThemedText>
        )}
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

      {showBulkBar ? (
        <View
          style={[
            styles.bulkActionBar,
            { borderColor: itemBorderColor, backgroundColor: inputBackground },
          ]}
        >
          <View style={styles.bulkSummary}>
            <ThemedText style={styles.bulkSummaryText}>
              {selectedCount} seleccionados
            </ThemedText>
            <View style={styles.bulkHelpers}>
              <TouchableOpacity onPress={selectAllVisible} disabled={allVisibleSelected}>
                <ThemedText style={styles.bulkHelperAction}>
                  {allVisibleSelected
                    ? 'Todo seleccionado'
                    : `Seleccionar ${totalVisible}`}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearSelection}>
                <ThemedText style={styles.bulkHelperAction}>Limpiar</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.bulkActionsRow}>
            {canEdit ? (
              <TouchableOpacity
                style={[styles.bulkActionButton, { backgroundColor: actionColor }]}
                onPress={() => handleBulkDecision('approve')}
                disabled={bulkActionLoading}
              >
                <ThemedText style={[styles.bulkActionLabel, { color: actionTextColor }]}>Aprobar</ThemedText>
              </TouchableOpacity>
            ) : null}
            {canEdit ? (
              <TouchableOpacity
                style={[styles.bulkActionButton, { backgroundColor: actionColor }]}
                onPress={() => handleBulkDecision('reject')}
                disabled={bulkActionLoading}
              >
                <ThemedText style={[styles.bulkActionLabel, { color: actionTextColor }]}>Rechazar</ThemedText>
              </TouchableOpacity>
            ) : null}
            {canDelete ? (
              <TouchableOpacity
                style={[styles.bulkActionButton, styles.bulkActionDanger]}
                onPress={handleBulkDelete}
                disabled={bulkActionLoading}
              >
                <ThemedText style={[styles.bulkActionLabel, styles.bulkActionDangerText]}>Eliminar</ThemedText>
              </TouchableOpacity>
            ) : null}
            {bulkActionLoading ? (
              <ActivityIndicator style={styles.bulkSpinner} color={spinnerColor} />
            ) : null}
          </View>
        </View>
      ) : null}

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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
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
  kpiSection: {
    marginBottom: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiRowSpacing: {
    marginTop: 12,
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  kpiCardMuted: {
    opacity: 0.85,
  },
  kpiLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  emptyKpiText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  quickViewsContainer: {
    marginBottom: 12,
  },
  quickViewsContent: {
    flexDirection: 'row',
    gap: 10,
  },
  quickViewChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickViewChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  quickViewText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickViewTextActive: {
    color: '#ffffff',
  },
  savedViewsSection: {
    marginBottom: 16,
  },
  savedViewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saveViewToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveViewToggleText: {
    fontWeight: '600',
  },
  saveViewForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  saveViewInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  saveViewButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  saveViewButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  savedViewsContent: {
    flexDirection: 'row',
    gap: 12,
  },
  savedViewChip: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    minWidth: 160,
  },
  savedViewChipActive: {
    borderColor: '#2563eb',
  },
  savedViewName: {
    fontWeight: '700',
    marginBottom: 6,
  },
  savedViewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savedViewActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  savedViewActionDelete: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
    marginLeft: 12,
  },
  savedViewsEmptyText: {
    fontSize: 13,
    fontStyle: 'italic',
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
  itemHeaderInfo: {
    flex: 1,
    marginRight: 12,
  },
  checkboxWrapper: {
    padding: 4,
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
  bulkActionBar: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 12,
  },
  bulkSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bulkSummaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulkHelpers: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkHelperAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  bulkActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  bulkActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bulkActionLabel: {
    fontWeight: '700',
  },
  bulkActionDanger: {
    backgroundColor: '#fee2e2',
  },
  bulkActionDangerText: {
    color: '#b91c1c',
  },
  bulkSpinner: {
    marginLeft: 4,
  },
});

