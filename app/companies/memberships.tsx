import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedTextInput } from '@/components/ThemedTextInput';
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
    requestMembership,
    approveMembership,
    rejectMembership,
    cancelInvitation,
    canListMemberships,
    canRequestMembership,
    canApproveMemberships,
    canRejectMemberships,
    canCancelInvitations,
  } = useContext(CompanyMembershipsContext);
  const { profiles, getProfile } = useContext(ProfilesContext);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestType, setRequestType] = useState<'administrator' | 'membership' | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestRole, setRequestRole] = useState('');
  const [requestDepartment, setRequestDepartment] = useState('');
  const [requestPosition, setRequestPosition] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [membershipActionLoading, setMembershipActionLoading] = useState<number | null>(null);

  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
  const spinnerColor = useThemeColor({}, 'tint');
  const badgeTextColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');
  const actionBackground = useThemeColor({}, 'button');
  const actionText = useThemeColor({}, 'buttonText');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1f2937' }, 'background');
  const successBackground = useThemeColor({ light: '#16a34a', dark: '#22c55e' }, 'tint');
  const dangerBackground = useThemeColor({ light: '#ef4444', dark: '#f87171' }, 'text');
  const neutralBackground = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');
  const modalOverlay = useThemeColor({ light: 'rgba(0,0,0,0.35)', dark: 'rgba(0,0,0,0.65)' }, 'background');

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

  const resetRequestForm = useCallback(() => {
    setRequestType(null);
    setRequestMessage('');
    setRequestRole('');
    setRequestDepartment('');
    setRequestPosition('');
  }, []);

  const handleRequest = useCallback(
    (type: 'administrator' | 'membership') => {
      if (!canRequestMembership) {
        Alert.alert(
          'Acceso restringido',
          'No tienes permisos para enviar solicitudes de membresía a esta empresa.',
        );
        return;
      }
      const defaultRole = type === 'administrator' ? 'administrator' : 'member';
      setRequestRole(defaultRole);
      setRequestMessage('');
      setRequestDepartment('');
      setRequestPosition('');
      setRequestType(type);
    },
    [canRequestMembership],
  );

  const handleSubmitRequest = useCallback(async () => {
    if (!validCompanyId || !requestType) {
      return;
    }
    setRequestSubmitting(true);
    try {
      const payload = {
        message: requestMessage.trim() || undefined,
        role: requestRole.trim() || (requestType === 'administrator' ? 'administrator' : 'member'),
        department: requestDepartment.trim() || undefined,
        position_title: requestPosition.trim() || undefined,
      };
      const ok = await requestMembership(validCompanyId, payload);
      if (ok) {
        Alert.alert('Solicitud enviada', 'La empresa recibirá tu solicitud y podrá aprobarla.');
        resetRequestForm();
        await loadMemberships(validCompanyId, 'all');
      } else {
        Alert.alert('Error', 'No se pudo registrar la solicitud. Inténtalo nuevamente.');
      }
    } finally {
      setRequestSubmitting(false);
    }
  }, [
    loadMemberships,
    requestDepartment,
    requestMembership,
    requestMessage,
    requestPosition,
    requestRole,
    requestType,
    resetRequestForm,
    validCompanyId,
  ]);

  const refreshAfterMutation = useCallback(async () => {
    if (!validCompanyId) {
      return;
    }
    await loadMemberships(validCompanyId, 'all');
  }, [loadMemberships, validCompanyId]);

  const handleApproveMembership = useCallback(
    async (membership: CompanyMembership) => {
      if (!validCompanyId || !canApproveMemberships) {
        return;
      }
      Alert.alert('Aprobar solicitud', '¿Confirmas que deseas habilitar a esta persona?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          style: 'default',
          onPress: async () => {
            setMembershipActionLoading(membership.id);
            try {
              const ok = await approveMembership(validCompanyId, membership.id, {
                role: membership.role || undefined,
              });
              if (ok) {
                Alert.alert('Solicitud aprobada', 'La membresía se actualizó correctamente.');
                await refreshAfterMutation();
              } else {
                Alert.alert('Error', 'No fue posible aprobar la solicitud.');
              }
            } finally {
              setMembershipActionLoading(null);
            }
          },
        },
      ]);
    },
    [approveMembership, canApproveMemberships, refreshAfterMutation, validCompanyId],
  );

  const handleRejectMembership = useCallback(
    async (membership: CompanyMembership) => {
      if (!validCompanyId || !canRejectMemberships) {
        return;
      }
      Alert.alert('Rechazar solicitud', '¿Deseas rechazar esta petición?', [
        { text: 'Cerrar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setMembershipActionLoading(membership.id);
            try {
              const ok = await rejectMembership(validCompanyId, membership.id, {});
              if (ok) {
                Alert.alert('Solicitud rechazada', 'La persona fue notificada del rechazo.');
                await refreshAfterMutation();
              } else {
                Alert.alert('Error', 'No se pudo rechazar la solicitud.');
              }
            } finally {
              setMembershipActionLoading(null);
            }
          },
        },
      ]);
    },
    [canRejectMemberships, rejectMembership, refreshAfterMutation, validCompanyId],
  );

  const handleCancelInvitation = useCallback(
    async (membership: CompanyMembership) => {
      if (!validCompanyId || !canCancelInvitations) {
        return;
      }
      Alert.alert('Cancelar invitación', '¿Anular la invitación antes de que sea aceptada?', [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar invitación',
          style: 'destructive',
          onPress: async () => {
            setMembershipActionLoading(membership.id);
            try {
              const ok = await cancelInvitation(validCompanyId, membership.id, {});
              if (ok) {
                Alert.alert('Invitación cancelada', 'Se revocó el token de ingreso.');
                await refreshAfterMutation();
              } else {
                Alert.alert('Error', 'No se pudo cancelar la invitación.');
              }
            } finally {
              setMembershipActionLoading(null);
            }
          },
        },
      ]);
    },
    [cancelInvitation, canCancelInvitations, refreshAfterMutation, validCompanyId],
  );

  const renderActions = useCallback(
    (membership: CompanyMembership) => {
      const actions: { label: string; onPress: () => void; variant: 'success' | 'danger' | 'neutral' }[] = [];

      if (membership.status === 'pending') {
        if (canApproveMemberships) {
          actions.push({ label: 'Aprobar', onPress: () => void handleApproveMembership(membership), variant: 'success' });
        }
        if (canRejectMemberships) {
          actions.push({ label: 'Rechazar', onPress: () => void handleRejectMembership(membership), variant: 'danger' });
        }
      }

      if (membership.status === 'invited' && canCancelInvitations) {
        actions.push({ label: 'Cancelar invitación', onPress: () => void handleCancelInvitation(membership), variant: 'danger' });
      }

      if (!actions.length) {
        return null;
      }

      return (
        <View style={styles.actionsRow}>
          {actions.map(action => {
            const isLoading = membershipActionLoading === membership.id;
            const backgroundColor =
              action.variant === 'success'
                ? successBackground
                : action.variant === 'danger'
                  ? dangerBackground
                  : neutralBackground;
            return (
              <TouchableOpacity
                key={`${membership.id}-${action.label}`}
                onPress={action.onPress}
                disabled={isLoading}
                style={[styles.actionButton, { backgroundColor, opacity: isLoading ? 0.6 : 1 }]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.actionButtonText}>{action.label}</ThemedText>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    },
    [
      canApproveMemberships,
      canCancelInvitations,
      canRejectMemberships,
      dangerBackground,
      handleApproveMembership,
      handleCancelInvitation,
      handleRejectMembership,
      membershipActionLoading,
      neutralBackground,
      successBackground,
    ],
  );

  const renderRequestModal = useCallback(() => {
    if (!requestType) {
      return null;
    }

    const title = requestType === 'administrator' ? 'Solicitud para administrador' : 'Solicitud de membresía';
    const keyboardOffset = Platform.OS === 'ios' ? 100 : 0;

    return (
      <Modal visible transparent animationType="fade" onRequestClose={resetRequestForm}>
        <View style={[styles.modalOverlay, { backgroundColor: modalOverlay }]}>
          <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={keyboardOffset} style={{ flex: 1 }}>
            <View style={[styles.modalCard, { backgroundColor: cardBackground, borderColor }]}> 
              <ThemedText style={styles.modalTitle}>{title}</ThemedText>
              <ThemedText style={styles.modalSubtitle}>
                Completa los campos opcionales para que la empresa pueda identificarte.
              </ThemedText>

              <ThemedText style={styles.label}>Rol sugerido</ThemedText>
              <ThemedTextInput
                value={requestRole}
                onChangeText={setRequestRole}
                placeholder={requestType === 'administrator' ? 'administrator' : 'member'}
              />

              <ThemedText style={styles.label}>Mensaje</ThemedText>
              <ThemedTextInput
                value={requestMessage}
                onChangeText={setRequestMessage}
                placeholder="Contanos por qué querés sumarte"
                multiline
                style={styles.multiline}
              />

              <ThemedText style={styles.label}>Departamento (opcional)</ThemedText>
              <ThemedTextInput
                value={requestDepartment}
                onChangeText={setRequestDepartment}
                placeholder="Finanzas, IT, Ventas..."
              />

              <ThemedText style={styles.label}>Cargo o puesto (opcional)</ThemedText>
              <ThemedTextInput
                value={requestPosition}
                onChangeText={setRequestPosition}
                placeholder="Ej: Analista Sr"
              />

              <View style={styles.modalActions}>
                <ThemedButton title="Cancelar" onPress={resetRequestForm} style={styles.modalButton} />
                <ThemedButton
                  title={requestSubmitting ? 'Enviando...' : 'Enviar solicitud'}
                  onPress={handleSubmitRequest}
                  disabled={requestSubmitting}
                  style={[styles.modalButton, { backgroundColor: actionBackground }]}
                  textStyle={{ color: actionText }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }, [
    actionBackground,
    actionText,
    borderColor,
    cardBackground,
    handleSubmitRequest,
    modalOverlay,
    requestDepartment,
    requestMessage,
    requestPosition,
    requestRole,
    requestSubmitting,
    requestType,
    resetRequestForm,
  ]);

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

        <TouchableOpacity
          style={[styles.requestButton, { backgroundColor: actionBackground }]}
          activeOpacity={0.85}
          onPress={() => handleRequest('administrator')}
        >
          <ThemedText style={[styles.requestButtonText, { color: actionText }]}>Solicitar ser administrador</ThemedText>
        </TouchableOpacity>
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
                  {renderActions(member)}
                </View>
              );
            })}
          </View>
        ) : (
          <ThemedText style={styles.emptyText}>No hay solicitudes ni miembros registrados.</ThemedText>
        )}

        <TouchableOpacity
          style={[styles.requestButton, { backgroundColor: actionBackground }]}
          activeOpacity={0.85}
          onPress={() => handleRequest('membership')}
        >
          <ThemedText style={[styles.requestButtonText, { color: actionText }]}>Solicitar ser miembro</ThemedText>
        </TouchableOpacity>
      </View>
      {renderRequestModal()}
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
  requestButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  requestButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
  },
});
