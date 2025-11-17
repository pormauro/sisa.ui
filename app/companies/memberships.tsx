import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import CircleImagePicker from '@/components/CircleImagePicker';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CompaniesContext } from '@/contexts/CompaniesContext';
import {
  CompanyMembership,
  CompanyMembershipStatus,
  CompanyMembershipsContext,
} from '@/contexts/CompanyMembershipsContext';
import { ProfilesContext } from '@/contexts/ProfilesContext';

const STATUS_LABELS: Record<CompanyMembershipStatus, { label: string; color: string }> = {
  pending: { label: 'Solicitado', color: '#f59e0b' },
  invited: { label: 'Invitado', color: '#3b82f6' },
  approved: { label: 'Aprobado', color: '#16a34a' },
  rejected: { label: 'Rechazado', color: '#ef4444' },
  cancelled: { label: 'Cancelado', color: '#9ca3af' },
  left: { label: 'Abandonó', color: '#f97316' },
  removed: { label: 'Removido', color: '#dc2626' },
  suspended: { label: 'Suspendido', color: '#8b5cf6' },
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString();
};

const hasContent = (value?: string | null) => Boolean(value && value.trim().length);

const normalizeAdministratorIds = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(id => String(id ?? '').trim())
    .filter((id): id is string => Boolean(id.length));
};

const buildMembershipDetails = (membership: CompanyMembership) => {
  const rows: { label: string; value: string }[] = [];

  if (hasContent(membership.role)) {
    rows.push({ label: 'Rol declarado', value: membership.role!.trim() });
  }
  if (hasContent(membership.position_title)) {
    rows.push({ label: 'Cargo', value: membership.position_title!.trim() });
  }
  if (hasContent(membership.department)) {
    rows.push({ label: 'Departamento', value: membership.department!.trim() });
  }
  if (hasContent(membership.employment_type)) {
    rows.push({ label: 'Tipo de vinculación', value: membership.employment_type!.trim() });
  }
  const start = formatDate(membership.started_at);
  const end = formatDate(membership.ended_at);
  if (start || end) {
    const label = end ? 'Vigencia' : 'Inicio';
    const range = end ? `${start ?? 'Sin dato'} → ${end}` : start ?? '';
    if (range) {
      rows.push({ label, value: range });
    }
  }
  if (hasContent(membership.visibility)) {
    rows.push({ label: 'Visibilidad', value: membership.visibility!.trim() });
  }
  if (hasContent(membership.profile_excerpt)) {
    rows.push({ label: 'Perfil', value: membership.profile_excerpt!.trim() });
  }
  if (hasContent(membership.message)) {
    rows.push({ label: 'Mensaje', value: membership.message!.trim() });
  }
  if (hasContent(membership.notes)) {
    rows.push({ label: 'Notas internas', value: membership.notes!.trim() });
  }

  return rows;
};

export default function CompanyMembershipsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const companyId = Number(id);
  const validCompanyId = Number.isFinite(companyId) ? companyId : null;

  const { companies } = useContext(CompaniesContext);
  const {
    membershipsByCompany,
    loadMemberships,
    canListMemberships,
  } = useContext(CompanyMembershipsContext);
  const { profiles, getProfile } = useContext(ProfilesContext);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const badgeTextColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');

  const company = useMemo(
    () => companies.find(item => item.id === validCompanyId) ?? null,
    [companies, validCompanyId],
  );

  const administratorIds = useMemo(
    () => normalizeAdministratorIds(company?.administrator_ids),
    [company],
  );

  const membershipList = useMemo(() => {
    if (!validCompanyId) {
      return [] as CompanyMembership[];
    }
    const byCompany = membershipsByCompany[validCompanyId];
    if (!byCompany) {
      return [] as CompanyMembership[];
    }
    const allMemberships = byCompany.all ?? [];
    return Array.isArray(allMemberships) ? (allMemberships as CompanyMembership[]) : [];
  }, [membershipsByCompany, validCompanyId]);

  const administratorUserIds = useMemo(() => {
    return administratorIds
      .map(id => {
        const parsed = Number(id);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => value !== null);
  }, [administratorIds]);

  const membershipUserIds = useMemo(() => {
    const collected = new Set<number>();
    membershipList.forEach(member => {
      if (Number.isFinite(member.user_id)) {
        collected.add(member.user_id);
      }
    });
    return Array.from(collected);
  }, [membershipList]);

  const requiredUserIds = useMemo(() => {
    const combined = new Set<number>();
    administratorUserIds.forEach(id => combined.add(id));
    membershipUserIds.forEach(id => combined.add(id));
    return Array.from(combined);
  }, [administratorUserIds, membershipUserIds]);

  useEffect(() => {
    const missing = requiredUserIds.filter(userId => !profiles[userId]);
    missing.forEach(userId => {
      void getProfile(userId);
    });
  }, [requiredUserIds, profiles, getProfile]);

  const administratorsData = useMemo(
    () =>
      administratorIds.map(adminId => {
        const parsedId = Number(adminId);
        const userId = Number.isFinite(parsedId) ? parsedId : null;
        const profile = userId ? profiles[userId] : null;
        const displayName = profile?.full_name?.trim();
        const avatarFileId = profile?.profile_file_id
          ? String(profile.profile_file_id)
          : undefined;
        return {
          key: adminId,
          userId,
          name:
            displayName && displayName.length
              ? displayName
              : userId
                ? `Usuario #${userId}`
                : `ID ${adminId}`,
          fileId: avatarFileId,
        };
      }),
    [administratorIds, profiles],
  );

  const fetchMemberships = useCallback(async () => {
    if (!validCompanyId || !canListMemberships) {
      setInitialLoading(false);
      return;
    }
    setInitialLoading(true);
    try {
      await loadMemberships(validCompanyId, 'all');
    } finally {
      setInitialLoading(false);
    }
  }, [canListMemberships, loadMemberships, validCompanyId]);

  useEffect(() => {
    void fetchMemberships();
  }, [fetchMemberships]);

  const handleRefresh = useCallback(async () => {
    if (!validCompanyId || !canListMemberships) {
      return;
    }
    setRefreshing(true);
    try {
      await loadMemberships(validCompanyId, 'all');
    } finally {
      setRefreshing(false);
    }
  }, [canListMemberships, loadMemberships, validCompanyId]);

  if (!validCompanyId || !company) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>Empresa no encontrada.</ThemedText>
      </View>
    );
  }

  if (!canListMemberships) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <ThemedText>
          No tienes permiso para listar las personas de esta empresa. Solicita acceso a &quot;Company Memberships&quot;.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollContainer, { backgroundColor: background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={[styles.card, { borderColor }]}> 
        <ThemedText style={styles.sectionTitle}>Administradores</ThemedText>
        {administratorIds.length ? (
          <View style={styles.chipGroup}>
            {administratorsData.map(admin => (
              <View key={admin.key} style={[styles.chip, { borderColor }]}>
                <CircleImagePicker
                  fileId={admin.fileId}
                  size={32}
                  editable={false}
                  style={styles.chipAvatar}
                />
                <ThemedText style={styles.chipLabel}>{admin.name}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.emptyText}>Sin administradores declarados.</ThemedText>
        )}
      </View>

      <View style={[styles.card, { borderColor }]}> 
        <ThemedText style={styles.sectionTitle}>Miembros y solicitudes</ThemedText>
        {initialLoading ? (
          <View style={styles.loaderWrapper}>
            <ActivityIndicator size="small" color={spinnerColor} />
          </View>
        ) : membershipList.length ? (
          <View style={styles.membersList}>
            {membershipList.map(member => {
              const statusData = STATUS_LABELS[member.status];
              const details = buildMembershipDetails(member);
              const profile = profiles[member.user_id];
              const displayName =
                profile?.full_name?.trim()?.length
                  ? profile.full_name.trim()
                  : `Usuario #${member.user_id || 'Desconocido'}`;
              const avatarFileId = profile?.profile_file_id
                ? String(profile.profile_file_id)
                : undefined;
              return (
                <View key={`membership-${member.id}`} style={[styles.memberCard, { borderColor }]}>
                  <View style={styles.memberHeader}>
                    <View style={styles.memberIdentity}>
                      <CircleImagePicker
                        fileId={avatarFileId}
                        size={42}
                        editable={false}
                        style={styles.memberAvatar}
                      />
                      <View>
                        <ThemedText style={styles.memberTitle}>{displayName}</ThemedText>
                        {hasContent(member.role) ? (
                          <ThemedText style={styles.memberSubtitle}>{member.role}</ThemedText>
                        ) : null}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusData?.color ?? '#6b7280' },
                      ]}
                    >
                      <ThemedText style={[styles.statusBadgeText, { color: badgeTextColor }]}>
                        {statusData?.label ?? member.status}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.memberMeta}>
                    <ThemedText style={styles.metaLabel}>ID de membresía</ThemedText>
                    <ThemedText style={styles.metaValue}>#{member.id}</ThemedText>
                  </View>
                  {details.map(detail => (
                    <View key={`${member.id}-${detail.label}`} style={styles.memberMeta}>
                      <ThemedText style={styles.metaLabel}>{detail.label}</ThemedText>
                      <ThemedText style={styles.metaValue}>{detail.value}</ThemedText>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        ) : (
          <ThemedText style={styles.emptyText}>No hay solicitudes ni miembros registrados.</ThemedText>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipAvatar: {
    marginRight: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loaderWrapper: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  membersList: {
    gap: 16,
  },
  memberCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  memberIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  memberAvatar: {
    marginRight: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  memberMeta: {
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
